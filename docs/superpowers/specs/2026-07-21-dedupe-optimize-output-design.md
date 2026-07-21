# Remove duplicate resumeData generation from optimizeResume

## Problem

Profiling of `POST /api/optimize` shows the bottleneck is entirely LLM
inference: 5,582 input tokens, 4,672 output tokens, 63.5s of Claude
latency, versus <20ms combined for parsing/validation/DB work.

`ClaudeProvider.optimizeResume` (`lib/ai/providers/claude.ts`) makes one
`messages.create` call whose output schema (`optimizationResultSchema`)
asks the model to produce the fully rewritten resume twice in the same
response:

- `sections[]` — a flat `{ id, optimizedText }` per input section.
- `resumeData` — the same rewritten content restructured into contact /
  experience / education / skills / projects / customSections.

`sections[].optimizedText` is not consumed anywhere. `app/api/optimize/
route.ts` never reads `result.sections`; no frontend component reads it;
the only code that would have consumed a flat rewritten-section list
(`rewriteDocx` in `lib/parsing/docx.ts`, for in-place DOCX editing) is
unused dead code from before the app moved to rendering resumes from
scratch via `pdfTemplate.tsx`/`docxTemplate.ts`. Every field `sections`
would carry already exists inside `resumeData`.

This duplication — not the number of API calls — is the dominant cost.
A prior design (`2026-07-14-merge-optimize-extract-design.md`) merged
what was originally two sequential Claude calls (rewrite, then extract)
into one specifically because the two-call flow measured ~100s
(60s + 40s) versus ~63.5s merged. Reintroducing a two-call split (as
`OpenRouterProvider` still does, and as an earlier version of this
problem's write-up proposed) risks undoing that latency win, since it
re-pays a full network round trip and re-sends the resume/job-description
input a second time. The actual fix is to stop asking the single call to
generate the same content twice, not to change how many calls there are.

## Goal

Cut Claude's `optimizeResume` output size (and therefore latency) by
having the model emit the rewritten resume exactly once, as `resumeData`,
with no separate flat `sections` pass — while keeping the single-call
architecture that the 2026-07-14 merge already validated as faster than
two calls.

## Scope

Changed:
- `lib/ai/types.ts` — `optimizationResultSchema` drops the `sections`
  field; `OptimizationResult` shrinks accordingly.
- `lib/ai/providers/claude.ts` — `SYSTEM_PROMPT` rewritten to target
  `resumeData` directly instead of a rewrite-then-extract two-step
  description; `max_tokens` reduced from 16000.
- `lib/ai/providers/openrouter.ts` — internal `rewriteResultSchema`
  becomes its own explicit schema (no longer derived from
  `optimizationResultSchema.omit({ resumeData: true })`, since the base
  schema no longer has `sections` to omit around). No behavioral change
  to OpenRouter's request flow.

Unchanged:
- `app/api/optimize/route.ts` — never read `result.sections`; needs no
  edits.
- Call count for either provider (Claude: 1 call, OpenRouter: 2 calls).
- `sections` cannot meaningfully change (e.g. contact info, education
  dates) prompt tuning — explicitly out of scope for this pass; revisit
  only if the schema trim alone doesn't get latency far enough.
- Frontend, rendering, DB schema — untouched; `resumeData`'s shape and
  meaning are unchanged, only how it's produced changes.

## Design

### Types (`lib/ai/types.ts`)

```ts
export const optimizationResultSchema = z.object({
  atsScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  summaryOfChanges: z.object({
    headline: z.string(),
    bullets: z.array(z.string()),
  }),
  resumeData: ResumeDataSchema,
});
export type OptimizationResult = z.infer<typeof optimizationResultSchema>;
```

`AiProvider`'s `optimizeResume` signature is unchanged — it already
returns `Promise<OptimizationResult>`; only the shape of that type
shrinks.

### ClaudeProvider (`lib/ai/providers/claude.ts`)

- `buildOutputSchema(optimizationResultSchema)` now generates a JSON
  schema with no `sections` property, so Claude's structured-output
  contract never asks for it.
- `SYSTEM_PROMPT` is rewritten as a single instruction set (no more
  "Do two things, in order"): rewrite the resume to align with the job
  description's language/keywords/requirements, and emit the result
  directly as the structured `resumeData` fields. The existing
  constraints carry over unchanged, just retargeted at `resumeData`:
  - Never fabricate experience, employers, dates, degrees, or skills.
  - Keep rewritten content roughly the same length as the original —
    reframing, not expanding.
  - Preserve names, contact info, dates essentially as written.
  - Estimate `atsScore` for the optimized resume against the job
    description; list `matchedKeywords`/`missingKeywords`.
  - The existing "Structured extraction rules" (contact from opening
    segments, experience/education/projects/skills/customSections
    shape, keep dates as written, omit optional fields rather than
    empty strings) become the primary rules, since `resumeData` is now
    the only output representation.
  - Drop "Return optimizedText for every section id you were given,
    even if unchanged" — there is no more `sections` field for this
    rule to apply to.
- `max_tokens` reduced from 16000 to 10000 — generous headroom above
  the ~2,500 tokens expected once the duplicate pass is removed
  (roughly half of the observed 4,672), without leaving 16k of unused
  allowance.
- Call shape is otherwise unchanged: still one `messages.create`, same
  request logging, same `max_tokens`-truncation guard, same
  `optimizationResultSchema.parse(JSON.parse(...))` on the response.

### OpenRouterProvider (`lib/ai/providers/openrouter.ts`)

No change to request flow or latency — it already does the rewrite and
the extraction as two separate fetches, and its first fetch's `sections`
output is genuinely consumed (as input to the second, extraction,
fetch), so there's no duplication to remove here.

Only adjustment: `rewriteResultSchema` is currently
`optimizationResultSchema.omit({ resumeData: true })`, relying on the
base schema having a `sections` field to keep. Since the base schema no
longer has `sections`, `rewriteResultSchema` becomes its own explicit
schema local to this file:

```ts
const rewriteResultSchema = z.object({
  sections: z.array(z.object({ id: z.string(), optimizedText: z.string() })),
  atsScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  summaryOfChanges: z.object({
    headline: z.string(),
    bullets: z.array(z.string()),
  }),
});
```

`optimizeResume`'s return still assembles the public shape as
`{ ...rewritten-minus-sections, resumeData }`; since `rewritten` no
longer overlaps with `OptimizationResult`'s fields once `sections` is
excluded, this can spread cleanly (e.g. destructure `sections` out
before spreading, or build the returned object field-by-field).

### `app/api/optimize/route.ts`

No changes. It only ever reads `result.atsScore`, `result.
matchedKeywords`, `result.missingKeywords`, `result.resumeData`, and
`result.summaryOfChanges` — none of which change shape or meaning.

## Testing

No automated tests cover this path (per project convention). Manual
verification:

1. Run the dev server with `AI_PROVIDER=claude`. Optimize a `.docx`
   resume; confirm `resumeData` populates correctly and its content
   matches/improves on the source, `atsScore`/keyword lists/
   `summaryOfChanges` all look sane.
2. Repeat with a `.pdf` resume.
3. Compare `console.time("Optimizing resume with AI")` and the
   `[Claude][Optimize]` `usage`/`llmTimeMs` logs against the baseline
   (5,582 input / 4,672 output tokens, 63.5s) to confirm output tokens
   drop substantially and latency improves.
4. Confirm the response never hits the `max_tokens`-truncation guard at
   the new 10000 ceiling.
5. Switch to `AI_PROVIDER=openrouter` and confirm `optimizeResume` still
   works end-to-end with unchanged latency/output shape (two fetches,
   `resumeData` populated via the internal extraction call).
