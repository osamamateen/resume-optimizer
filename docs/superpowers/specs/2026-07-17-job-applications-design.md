# Job applications (multiple resume versions)

## Problem

Users apply to multiple roles at once, but the app is entirely stateless
today: upload → job description → optimize → download, with nothing
persisted beyond auth (`User`/`RefreshToken`). Every optimization is
disconnected from every other — there's no way to keep a resume tailored
for one job separate from one tailored for another, revisit a past
result, or avoid re-uploading the same base resume each time.

## Goal

- A user can maintain one "master" resume on their account and reuse it
  across applications, or override it with a different upload for a
  single application.
- Each job application (company + role + job description + tailored
  resume result) is saved as its own record the user can revisit, view,
  re-download, or delete later.
- Logging in shows a dashboard of past applications instead of jumping
  straight into the upload flow.

## Scope

New:
- `prisma/schema.prisma` — `MasterResume`, `Application` models.
- `app/api/master-resume/route.ts` — `GET` (metadata) / `POST` (upload or
  replace).
- `app/api/applications/route.ts` — `GET` (list for dashboard).
- `app/api/applications/[id]/route.ts` — `GET` (detail) / `DELETE`.
- `app/applications/new/page.tsx` — the new-application flow (moved and
  extended from the current `app/page.tsx`).
- `app/applications/[id]/page.tsx` — read-only detail/view page for a
  saved application, reusing `ResultView`.
- A resume-source step component (master vs. override upload) for the
  new-application flow.

Changed:
- `app/api/optimize/route.ts` — accepts `companyName`, `roleTitle`, and
  either a `resume` file (override) or `useMaster: true`; on success,
  persists a new `Application` row and returns its `id`.
- `app/page.tsx` — becomes the applications dashboard (list + "New
  application" button + master-resume filename/replace affordance).

Unchanged: `ResultView`, `/api/resume/render`, `/api/templates`, all
existing parsing/AI/rendering modules — this feature is purely additive
persistence around the existing optimize/render flow.

Out of scope: application status tracking (applied/interviewing/etc.),
notes/dates, master-resume version history, file storage outside
Postgres, automated tests (none exist in this repo yet — see Testing).

## Design

### Data model (Prisma + Postgres)

```prisma
model MasterResume {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  fileName  String
  mimeType  String
  fileData  Bytes
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Application {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  companyName      String
  roleTitle        String
  jobDescription   String
  resumeData       Json
  atsScore         Int
  matchedKeywords  Json
  missingKeywords  Json
  summaryHeadline  String
  summaryBullets   Json
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([userId, createdAt])
}
```

Key decisions:
- `MasterResume` stores the original file bytes (needed to re-parse into
  `ResumeSection[]` and re-optimize against a new job description
  later). One per user (`userId` is `@unique`) — uploading a new one
  replaces the row entirely; there is no version history.
- `Application` stores **no file** — only the AI's structured output
  (`resumeData`, score, keywords, summary), exactly what `/api/optimize`
  already returns today. Downloads are regenerated on demand from
  `resumeData` via the existing `/api/resume/render`, never stored as
  rendered bytes, so there's no staleness risk if the renderer changes
  later.
- Even when a user overrides the master resume with a one-off upload for
  a single application, that file is used once to produce `resumeData`
  and then discarded — same as the current stateless behavior.
- Replacing the master resume never touches past `Application` rows —
  each already has its own frozen `resumeData` snapshot from creation
  time, so history stays accurate regardless of later master-resume
  changes.

### API routes

- **`POST /api/master-resume`** (multipart, auth required) — validates
  `.docx`/`.pdf` (same check as `/api/optimize` today), stores raw bytes
  + `fileName` + `mimeType`, upserts by `userId`.
- **`GET /api/master-resume`** — returns `{ fileName, updatedAt }` only,
  or 404 if none exists yet. Never returns `fileData`.
- **`GET /api/applications`** — list current user's applications:
  `{ id, companyName, roleTitle, atsScore, createdAt }[]`, ordered newest
  first.
- **`GET /api/applications/:id`** — full record for the detail page
  (`resumeData`, `jobDescription`, keywords, summary, `companyName`,
  `roleTitle`). 404 (not 401/403) if the id belongs to another user or
  doesn't exist.
- **`DELETE /api/applications/:id`** — hard delete; same ownership check
  as `GET`.
- **`POST /api/optimize`** (modified) — new fields `companyName`,
  `roleTitle`, and either a `resume` file (as today, override mode) or no
  file + `useMaster: true` (loads and parses the stored `MasterResume`
  server-side instead of requiring a re-upload). If `useMaster: true` but
  no `MasterResume` row exists, 400. On successful AI optimization, the
  route now also inserts a new `Application` row and includes its `id` in
  the response. If the AI call fails, nothing is written — only
  successful optimizations create history.

All new/modified routes keep the existing `requireAuth()`-first pattern
and scope every query to the authenticated `userId`.

### UI & flow changes

- **`app/page.tsx` becomes the dashboard**: fetches `GET
  /api/applications`, renders a list (company, role, ATS score, date),
  each row linking to `/applications/:id`. A "+ New application" button
  links to `/applications/new`. A small header affordance shows "Master
  resume: `<fileName>` · Replace", posting to `/api/master-resume` on
  replace.
- **`app/applications/new/page.tsx`** — the existing 3-step flow, with
  one new step at the front:
  1. **Company + role title** — simple text inputs.
  2. **Resume source** — "Use my master resume (`<fileName>`)"
     pre-selected when one exists, or "Upload a different resume for
     this application." If no master resume exists yet, upload is
     forced, with a checked-by-default "Save as my master resume"
     checkbox that triggers a `POST /api/master-resume` alongside the
     optimize call.
  3. **Job description** — unchanged.
  4. **Optimize** — unchanged call, now also sends
     `companyName`/`roleTitle`/`useMaster` (or the override file). On
     success, redirects to `/applications/:id` (the new record) instead
     of showing an inline result.
- **`app/applications/[id]/page.tsx`** — fetches `GET
  /api/applications/:id` and renders the existing `ResultView` component
  unmodified (score, keywords, summary, template picker, download
  button), plus a header showing company/role/job description and a
  delete action that calls `DELETE /api/applications/:id` and returns to
  the dashboard.
- `ResultView` requires no code changes — it already only needs
  `resumeData` + score/keywords/summary, regardless of whether they came
  from a live optimize call or a fetched record.

### Error handling & edge cases

- **"Use master" selected but none exists**: blocked client-side (step 2
  forces upload when no master resume is on file) and re-checked
  server-side in `/api/optimize` (400).
- **Optimize/AI failure**: existing 502 behavior is unchanged; no
  `Application` row is written on failure.
- **Unsupported file type**: same `.docx`/`.pdf` validation used today,
  reused for `/api/master-resume`.
- **Deleting an application**: hard delete of the DB row only — there
  are no associated files to clean up.
- **Replacing the master resume**: immediate overwrite, no versioning;
  safe because it never affects existing `Application` snapshots.
- **Ownership checks**: every new route filters by the authenticated
  `userId`; `GET`/`DELETE /api/applications/:id` return 404 (not
  401/403) when the id belongs to another user, to avoid leaking
  existence.

## Testing

No test runner exists in this repo yet (`package.json` has no test
script); adding one is out of scope here.