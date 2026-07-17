# Score, then optimize (split the one-shot flow)

## Problem

`/api/optimize` currently does everything in a single AI call: it scores
the *optimized* resume and rewrites it in one shot, then persists the
final `Application`. There's no ATS score for the original resume, no
suggestions the user can review before committing to a rewrite, and no
before/after comparison — a user creating an application immediately
gets a rewritten resume with no visibility into what changed or why.

## Goal

- Creating an application first scores the *original* resume against
  the job description (ATS score, matched/missing keywords, suggested
  improvements) and saves that immediately — before any rewrite happens.
- The user can review that scoring result on the application's detail
  page and choose, whenever they want, to actually optimize it.
- Once optimized, the detail page shows the new score compared to the
  original, keywords added vs. still missing, and a summary of changes
  — on top of the existing download/template functionality.

## Scope

New:
- `lib/ai/types.ts` — `scoreResultSchema`/`ScoreResult`, `scoreResume`
  added to the `AiProvider` interface.
- `lib/ai/providers/claude.ts`, `lib/ai/providers/openrouter.ts` — each
  implement `scoreResume` with a separate, no-rewrite system prompt.
- `app/api/score/route.ts` — `POST /api/score`, replaces `/api/optimize`'s
  current role (creates the `Application` in "scored" state).
- `app/api/optimize/route.ts` — rewritten: `POST /api/optimize` now
  takes `{ applicationId }` only and runs the actual rewrite against a
  previously-scored `Application`.
- `components/ScoringView.tsx` — score/keywords/suggestions + "Optimize
  this resume" button, shown for applications not yet optimized.

Changed:
- `prisma/schema.prisma` — `Application` gains `originalSections`,
  `originalAtsScore`, `originalMatchedKeywords`,
  `originalMissingKeywords`, `suggestionsHeadline`, `suggestionsBullets`;
  `resumeData`, `summaryHeadline`, `summaryBullets` become nullable.
- `app/api/applications/[id]/route.ts` — `GET` response includes the new
  original/suggestions fields; `resumeData`/`summaryOfChanges` are
  nullable in the response shape.
- `app/applications/new/page.tsx` — posts to `/api/score` instead of
  `/api/optimize`; otherwise unchanged.
- `app/applications/[id]/page.tsx` — branches on `resumeData === null`
  to show `ScoringView` (not yet optimized) or the updated `ResultView`
  (optimized).
- `components/ResultView.tsx` — gains required props
  `previousAtsScore: number` and `previousMissingKeywords: string[]`;
  renders a before/after score comparison and "keywords added" vs.
  "still missing" lists instead of a flat post-optimization view.

Unchanged: `POST /api/master-resume`, `GET /api/master-resume`,
`GET`/`DELETE /api/applications/:id` (aside from the response-shape
addition above), `POST /api/resume/render`, all parsing modules,
`ApplicationDetailsStep`, `ResumeSourceStep`, `JobDescriptionStep`,
`MasterResumeControl`.

Out of scope: re-optimizing against a *different* job description or
master resume after the fact (optimize always uses the exact
`originalSections`/`jobDescription` captured at scoring time); a UI
affordance to re-run scoring; automated tests (none exist in this repo).

## Design

### Data model (Prisma + Postgres)

```prisma
model Application {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  companyName     String
  roleTitle       String
  jobDescription  String

  // Frozen snapshot from the scoring step — never overwritten.
  originalSections        Json   // ResumeSection[], reused by the later optimize call
  originalAtsScore        Int
  originalMatchedKeywords Json
  originalMissingKeywords Json
  suggestionsHeadline     String
  suggestionsBullets      Json

  // "Current" state: starts equal to the original values, overwritten once optimized.
  atsScore        Int
  matchedKeywords Json
  missingKeywords Json

  // Only populated once Optimize has been run.
  resumeData      Json?
  summaryHeadline String?
  summaryBullets  Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, createdAt])
}
```

- `resumeData == null` is the sole state signal ("scored" vs.
  "optimized") — no separate status enum, so there's nothing to drift
  out of sync.
- `originalSections` is what lets `/api/optimize` run later without
  re-uploading or re-parsing anything, and without silently switching to
  a different master resume if the user replaced it in the meantime —
  optimize always operates on exactly the resume that was scored.
- The migration clears existing `Application` rows in the dev database
  first (all created during this session's own testing of the previous
  feature — no real user data exists yet), since they predate these new
  required columns.

### AI provider changes

`lib/ai/types.ts`:

```ts
export const scoreResultSchema = z.object({
  atsScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  suggestions: z.object({
    headline: z.string(),
    bullets: z.array(z.string()),
  }),
});
export type ScoreResult = z.infer<typeof scoreResultSchema>;

export interface AiProvider {
  scoreResume(request: OptimizeRequest): Promise<ScoreResult>;
  optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>;
}
```

`OptimizeRequest` (`{ sections, jobDescription }`) is reused for both
methods — the input shape is identical, only the prompt and output
differ. Each provider (`claude.ts`, `openrouter.ts`) implements
`scoreResume` with a distinct system prompt that explicitly does not
rewrite anything: it scores the resume exactly as given and proposes
improvements in the same `{ headline, bullets }` shape as
`summaryOfChanges`, for UI consistency. No structured `resumeData`
extraction happens at this stage — that keeps the scoring call cheaper
and faster than a full rewrite. `optimizeResume` itself is unchanged;
it's just invoked later, against the stored `originalSections` instead
of a fresh upload.

### API routes

- **`POST /api/score`** (new, replaces `/api/optimize`'s current role) —
  same multipart request shape as today: `companyName`, `roleTitle`,
  `jobDescription`, `useMaster`, and either `resume` (override) or
  nothing (loads the stored `MasterResume`). Parses the resume into
  `ResumeSection[]`, calls `ai.scoreResume(...)`, creates the
  `Application` with `original*` and "current" fields set identically
  from the score result, `resumeData`/`summaryHeadline`/`summaryBullets`
  left `null`. Returns `{ applicationId, atsScore, matchedKeywords,
  missingKeywords, suggestions }`. No `Application` row is created if
  the AI call fails.
- **`POST /api/optimize`** (rewritten) — JSON body `{ applicationId:
  string }` only. Loads the `Application` (ownership-checked, 404 if it
  belongs to another user or doesn't exist — same pattern as
  `GET`/`DELETE /api/applications/:id`), calls
  `ai.optimizeResume({ sections: application.originalSections,
  jobDescription: application.jobDescription })`, then updates
  `atsScore`/`matchedKeywords`/`missingKeywords`/`resumeData`/
  `summaryHeadline`/`summaryBullets` on the row — `original*` fields are
  never touched. Returns the full updated detail payload (same shape as
  `GET /api/applications/:id`). Re-running this on an already-optimized
  application is allowed (re-optimizes against the same frozen
  `originalSections`, overwriting the "current" fields again); the
  `original*` baseline stays fixed either way, so the comparison stays
  meaningful. If the AI call fails, the row is left untouched (still
  "scored") and a 502 is returned.
- **`GET /api/applications/:id`** — response gains `originalAtsScore`,
  `originalMatchedKeywords`, `originalMissingKeywords`, `suggestions:
  { headline, bullets }`; `resumeData` and `summaryOfChanges` become
  nullable in the response shape.

### UI changes

- **`app/applications/new/page.tsx`** — only its POST target changes,
  from `/api/optimize` to `/api/score`; steps, loading state, and the
  redirect to `/applications/:id` on success are unchanged.
- **`app/applications/[id]/page.tsx`** branches on `resumeData === null`:
  - **Not yet optimized** — renders `ScoringView`: company/role header,
    ATS score, matched/missing keyword lists, a "Suggested improvements"
    card (headline + bullets, same visual style as the existing "What
    changed" card), an **Optimize this resume** button that POSTs
    `{ applicationId }` to `/api/optimize`, shows a loading state, then
    re-fetches the application on success — plus the existing delete
    action.
  - **Optimized** — renders the updated `ResultView`, now given
    `previousAtsScore` (= `originalAtsScore`) and
    `previousMissingKeywords` (= `originalMissingKeywords`) in addition
    to its existing props. It renders a before → after score comparison
    in place of today's single score card, "Keywords added"
    (`previousMissingKeywords ∩` the new `matchedKeywords`) alongside
    "Still missing" (the new `missingKeywords`), then the unchanged
    "What changed" summary, template picker, and download button.
    Since `ResultView` has exactly one call site (this page, reached
    only once optimized), these new props are required, not optional.

### Error handling & edge cases

- **`/api/optimize` with an unknown/foreign `applicationId`**: 404,
  identical ownership-check pattern to `GET`/`DELETE
  /api/applications/:id`.
- **AI failure during scoring**: no `Application` row is created —
  identical to today's "AI failure during optimize creates nothing"
  behavior.
- **AI failure during optimize**: the row stays in "scored" state,
  nothing is partially overwritten; 502 returned.
- **Re-optimizing an already-optimized application**: allowed (see
  above) — there's no UI affordance for it yet (the button only appears
  in the "not yet optimized" state), but the endpoint itself doesn't
  reject it, since nothing about the data model requires it to.
