# Dedupe optimizeResume Output Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Claude's `optimizeResume` call from emitting the rewritten resume twice (an unused flat `sections[]` array plus the structured `resumeData`), cutting output tokens and latency without changing the single-call architecture.

**Architecture:** Trim the shared `optimizationResultSchema` to drop `sections`, retarget `ClaudeProvider`'s system prompt at `resumeData` directly, and adjust `OpenRouterProvider` (which still needs an internal, two-call-only `sections` representation) to keep compiling against the trimmed public type. `app/api/optimize/route.ts` is untouched — it never read `result.sections`.

**Tech Stack:** TypeScript, Zod, Next.js API routes, Anthropic SDK (`@anthropic-ai/sdk`), `fetch` (OpenRouter).

## Global Constraints

- `optimizationResultSchema` (`lib/ai/types.ts`) is shared by both providers — any shape change must keep both compiling.
- Claude's `optimizeResume` `max_tokens` drops from 16000 to 10000 (per design doc: ~2,500 tokens expected once the duplicate pass is removed, vs. the observed 4,672 baseline).
- `app/api/optimize/route.ts` gets no edits — confirmed it only reads `result.atsScore`, `result.matchedKeywords`, `result.missingKeywords`, `result.resumeData`, `result.summaryOfChanges`.
- No automated test runner in this project (see `CLAUDE.md`) — verification is manual: `npx tsc --noEmit` for compile-time checks, then running the dev server against real resume files.
- `OpenRouterProvider`'s request flow, call count, and latency are unchanged — only its internal schema definition changes to stop deriving from the trimmed public schema.
- Baseline to compare against (from profiling, Claude provider): 5,582 input tokens, 4,672 output tokens, 63.5s latency.

---

### Task 1: Trim `optimizationResultSchema` and retarget `ClaudeProvider`

**Files:**
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/providers/claude.ts`

**Interfaces:**
- Produces: `optimizationResultSchema` (Zod) / `OptimizationResult` (TS type) with fields `atsScore: number`, `matchedKeywords: string[]`, `missingKeywords: string[]`, `summaryOfChanges: { headline: string; bullets: string[] }`, `resumeData: ResumeData` — no `sections` field. This is the type Task 2 must keep `OpenRouterProvider.optimizeResume` returning.

- [ ] **Step 1: Remove `sections` from `optimizationResultSchema`**

In `lib/ai/types.ts`, replace:

```ts
export const optimizationResultSchema = z.object({
  sections: z.array(z.object({ id: z.string(), optimizedText: z.string() })),
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

with:

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

- [ ] **Step 2: Rewrite `ClaudeProvider`'s `SYSTEM_PROMPT` to target `resumeData` directly**

In `lib/ai/providers/claude.ts`, replace the `SYSTEM_PROMPT` constant:

```ts
const SYSTEM_PROMPT = `You are an expert resume editor specializing in ATS (Applicant Tracking System) optimization.
You will be given a resume broken into text sections (each with an id) and a target job description.

Do two things, in order:
1. Rewrite each section's text to better align with the job description's language, keywords, and requirements.
2. Extract the rewritten resume into the structured resumeData shape.

Rewriting rules:
- Never fabricate experience, employers, dates, degrees, or skills the candidate doesn't have.
- Keep each rewritten section roughly the same length as the original — you are reframing, not expanding.
- Preserve names, contact info, dates, and section headings essentially as written.
- Return optimizedText for every section id you were given, even if unchanged.
- Estimate an ATS match score (0-100) for the optimized resume against the job description, and list matched and missing keywords.

Structured extraction rules (apply to the rewritten text, for the resumeData field):
- Contact info (name, email, phone, location, optional: linkedin/github/website) comes from the opening segments
- Extract each job as an experience entry: title, company, location, startDate, endDate, and an array of bullet strings (strip bullet symbols)
- Extract each education entry: institution, degree, field, graduationDate
- If projects exist, extract them with name, description, technologies array, and bullets array
- If a skills section exists, classify into languages, frameworks, tools, other (each an array of strings)
- If any other section exists that doesn't fit the schema, add it as a customSections entry with label and content
- Dates should be kept as written (e.g. "Jan 2020", "2019 – Present")
- Omit optional fields rather than returning empty strings`;
```

with:

```ts
const SYSTEM_PROMPT = `You are an expert resume editor specializing in ATS (Applicant Tracking System) optimization.
You will be given a resume broken into text sections (each with an id) and a target job description.

Rewrite the resume to better align with the job description's language, keywords, and requirements, and emit the result directly as the structured resumeData shape below. Do not return a separate flat per-section representation — resumeData is the only place the rewritten text should appear.

Rewriting rules:
- Never fabricate experience, employers, dates, degrees, or skills the candidate doesn't have.
- Keep rewritten content roughly the same length as the original — you are reframing, not expanding.
- Preserve names, contact info, and dates essentially as written.
- Estimate an ATS match score (0-100) for the optimized resume against the job description, and list matched and missing keywords.

resumeData shape rules:
- Contact info (name, email, phone, location, optional: linkedin/github/website) comes from the opening segments
- Extract each job as an experience entry: title, company, location, startDate, endDate, and an array of bullet strings (strip bullet symbols)
- Extract each education entry: institution, degree, field, graduationDate
- If projects exist, extract them with name, description, technologies array, and bullets array
- If a skills section exists, classify into languages, frameworks, tools, other (each an array of strings)
- If any other section exists that doesn't fit the schema, add it as a customSections entry with label and content
- Dates should be kept as written (e.g. "Jan 2020", "2019 – Present")
- Omit optional fields rather than returning empty strings`;
```

- [ ] **Step 3: Lower `optimizeResume`'s `max_tokens`**

In `lib/ai/providers/claude.ts`, inside `optimizeResume`, change:

```ts
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
```

to:

```ts
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 10000,
      system: SYSTEM_PROMPT,
```

Leave `scoreResume`'s `max_tokens: 4000` untouched — it's a different method with a different schema, not part of this change.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

Expected: errors in `lib/ai/providers/openrouter.ts` only (it still references the old shape via `optimizationResultSchema.omit({ resumeData: true })` and spreads `sections` into a return typed as `OptimizationResult`). No errors in `lib/ai/types.ts` or `lib/ai/providers/claude.ts` — those two files should be clean. This confirms the type change took effect and correctly ripples into the one place that still needs fixing (Task 2).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/types.ts lib/ai/providers/claude.ts
git commit -m "$(cat <<'EOF'
perf: stop optimizeResume from emitting the resume twice

The Claude call asked for the rewritten resume both as a flat, unused
sections[] array and as resumeData. Drop sections from the shared
schema and retarget the prompt at resumeData directly; cuts output
tokens roughly in half per the 2026-07-21 dedupe-optimize-output spec.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Update `OpenRouterProvider` to match the trimmed schema

**Files:**
- Modify: `lib/ai/providers/openrouter.ts`

**Interfaces:**
- Consumes: `optimizationResultSchema` / `OptimizationResult` from Task 1 (no `sections` field).
- Produces: `OpenRouterProvider.optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>` — same public signature as before, now built field-by-field instead of via spread.

- [ ] **Step 1: Add the `zod` import and drop the now-unused `optimizationResultSchema` value import**

In `lib/ai/providers/openrouter.ts`, `optimizationResultSchema` (the Zod schema value) is currently imported only to build `rewriteResultSchema` via `.omit()` — after Step 2 below, nothing in this file calls it anymore, so keeping it imported would fail lint's unused-vars check. The `OptimizationResult` TS *type* is a separate, still-needed import (it comes from the `import type { ... }` line, not this one). Replace:

```ts
import type { AiProvider, OptimizeRequest, OptimizationResult, ScoreResult } from "../types";
import { optimizationResultSchema, scoreResultSchema } from "../types";
import { ResumeDataSchema } from "../../../types/resume.types";
import type { ResumeData } from "../../../types/resume.types";
```

with:

```ts
import type { AiProvider, OptimizeRequest, OptimizationResult, ScoreResult } from "../types";
import { scoreResultSchema } from "../types";
import { ResumeDataSchema } from "../../../types/resume.types";
import type { ResumeData } from "../../../types/resume.types";
import { z } from "zod";
```

- [ ] **Step 2: Replace the derived `rewriteResultSchema` with an explicit local schema**

Replace:

```ts
const rewriteResultSchema = optimizationResultSchema.omit({ resumeData: true });
```

with:

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

- [ ] **Step 3: Build the `optimizeResume` return value field-by-field**

In `lib/ai/providers/openrouter.ts`, inside `optimizeResume`, replace:

```ts
    const rewritten = rewriteResultSchema.parse(JSON.parse(content));
    const resumeData = await this.extractStructuredResume(rewritten.sections);

    return { ...rewritten, resumeData };
```

with:

```ts
    const rewritten = rewriteResultSchema.parse(JSON.parse(content));
    const resumeData = await this.extractStructuredResume(rewritten.sections);

    return {
      atsScore: rewritten.atsScore,
      matchedKeywords: rewritten.matchedKeywords,
      missingKeywords: rewritten.missingKeywords,
      summaryOfChanges: rewritten.summaryOfChanges,
      resumeData,
    };
```

This avoids spreading the now-mismatched `sections` field into a value typed as `OptimizationResult`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`

Expected: no errors anywhere in the project.

- [ ] **Step 5: Lint**

Run: `npm run lint`

Expected: no new errors/warnings in `lib/ai/providers/openrouter.ts` or `lib/ai/providers/claude.ts` or `lib/ai/types.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/ai/providers/openrouter.ts
git commit -m "$(cat <<'EOF'
fix: match OpenRouterProvider to the trimmed OptimizationResult type

sections stays internal to this provider's two-call flow (still needed
as input to the extraction fetch) but is no longer part of the public
return value, matching the shared schema trimmed in the previous commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Manual end-to-end verification against both providers

**Files:** none (verification only).

**Interfaces:**
- Consumes: the running app (`npm run dev`), a real `.docx` resume, a real `.pdf` resume, and a job description to paste in — same manual flow described in `CLAUDE.md`'s "Request flow" section (new application → score → optimize).

- [ ] **Step 1: Confirm required env vars are set**

Open `.env.local` and confirm `ANTHROPIC_API_KEY`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_HASH_SECRET` are all set (per `CLAUDE.md`'s Environment Variables table). Leave `AI_PROVIDER` unset or `claude` for the first pass.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`

Expected: server starts on `http://localhost:3000` with no build errors.

- [ ] **Step 3: Run the Claude path against a `.docx` resume**

In the browser: log in, create a new application, upload a `.docx` resume, submit a job description, wait for the score step, then click "Optimize this resume."

Watch the terminal running `npm run dev` for the `[Claude][Optimize]` log lines (the pre-existing profiling instrumentation in `lib/ai/providers/claude.ts`). Record:
- `usage` (input/output token counts) from the "Response received" log
- `llmTimeMs` from the same log
- `totalTimeMs` from the "Complete" log

Expected: output tokens meaningfully below the 4,672 baseline (roughly half, ~2,000–2,800), `llmTimeMs` meaningfully below the 63.5s baseline, and no `max_tokens`-truncation error thrown.

On the resulting `/applications/:id` page: confirm `ResultView` renders a populated resume (contact info, experience, education, etc. all present and sensibly rewritten toward the job description) — this is `resumeData` round-tripping correctly with no `sections` field involved.

- [ ] **Step 4: Repeat with a `.pdf` resume**

Same flow as Step 3, using a `.pdf` file instead. Confirm the same token/latency improvement and correct `resumeData` rendering.

- [ ] **Step 5: Confirm the OpenRouter path still works**

Set `AI_PROVIDER=openrouter` in `.env.local` (and `OPENROUTER_API_KEY`), restart `npm run dev`, and repeat the score → optimize flow once with either resume format.

Expected: works end-to-end exactly as before (two internal fetches — rewrite then extract), `resumeData` populates correctly. Latency is expected to be unchanged from before this change (this path was never duplicating output).

Restore `AI_PROVIDER` to its original value (or unset it) in `.env.local` when done.

- [ ] **Step 6: Record results**

No commit for this task — it's verification only. If either provider fails or the latency/token improvement doesn't materialize, stop and investigate before considering this plan complete (see `superpowers:systematic-debugging` if the failure isn't immediately obvious).
