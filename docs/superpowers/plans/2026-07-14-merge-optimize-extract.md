# Merge optimizeResume + extractStructuredResume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Claude-path resume optimization latency by merging the two sequential `optimizeResume` + `extractStructuredResume` calls into a single Claude API call, while leaving the OpenRouter provider's two-call flow working behind the same interface.

**Architecture:** `AiProvider.optimizeResume()` becomes the single method on the interface; its return type gains a `resumeData` field. `ClaudeProvider` fills that field via one combined `messages.create` call with an extended output schema and a merged system prompt. `OpenRouterProvider` fills it by internally calling a new *private* extraction method after its existing rewrite fetch — same external contract, same two-fetch cost as before. `route.ts` collapses to one call and one error path.

**Tech Stack:** Next.js (App Router, Node runtime), TypeScript, Zod, `@anthropic-ai/sdk`, plain `fetch` for OpenRouter. No test framework is configured in this repo (`npm run lint` and `tsc --noEmit` are the available static checks); verification here is typecheck + lint + manual runtime exercise through the dev server, matching how the rest of the codebase is verified (see `CLAUDE.md`).

## Global Constraints

- Do not change the public JSON shape returned by `POST /api/optimize` (`atsScore`, `matchedKeywords`, `missingKeywords`, `summaryOfChanges`, `resumeData`) — the frontend (`app/page.tsx`, `components/ResultView.tsx`) is unchanged in this plan and expects the existing shape.
- `AiProvider` must end up with exactly one method: `optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>`.
- `OptimizationResult` (from `lib/ai/types.ts`) must include `resumeData: ResumeData`.
- OpenRouter's latency and two-fetch behavior are intentionally unchanged — only its public interface shape changes.
- `ANTHROPIC_API_KEY`, `AI_PROVIDER`, and `OPENROUTER_API_KEY` are already set in local `.env.local`, so both provider paths can be exercised manually against real APIs during verification.

---

### Task 1: Extend the shared types and interface

**Files:**
- Modify: `lib/ai/types.ts`

**Interfaces:**
- Produces: `optimizationResultSchema` (Zod) now includes `resumeData: ResumeDataSchema`; `OptimizationResult` type now includes `resumeData: ResumeData`. `AiProvider` interface now has only `optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>`.

- [ ] **Step 1: Edit `lib/ai/types.ts`**

Replace the full file contents with:

```ts
import { z } from "zod";
import { ResumeDataSchema } from "../../types/resume.types";

export const sectionInputSchema = z.object({
  id: z.string(),
  heading: z.string().nullable(),
  originalText: z.string(),
});
export type SectionInput = z.infer<typeof sectionInputSchema>;

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

export interface OptimizeRequest {
  sections: SectionInput[];
  jobDescription: string;
}

export interface AiProvider {
  optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>;
}
```

- [ ] **Step 2: Run the type checker and confirm the expected (temporary) breakage**

Run: `npx tsc --noEmit`

Expected: exactly one error, in `app/api/optimize/route.ts`, on the line calling `ai.extractStructuredResume(...)`:

```
app/api/optimize/route.ts:54:16 - error TS2339: Property 'extractStructuredResume' does not exist on type 'AiProvider'.
```

No errors should appear in `lib/ai/providers/claude.ts` or `lib/ai/providers/openrouter.ts` at this point — their `optimizeResume` methods return `optimizationResultSchema.parse(...)`, which TypeScript trusts structurally from the Zod schema regardless of the actual runtime JSON shape, so the interface mismatch there is a *runtime* problem, not a compile-time one. That runtime gap is closed in Tasks 2 and 3. If you see errors anywhere other than that one `route.ts` line, stop and investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/types.ts
git commit -m "feat: add resumeData to OptimizationResult, shrink AiProvider to one method"
```

---

### Task 2: Merge Claude's two calls into one

**Files:**
- Modify: `lib/ai/providers/claude.ts`

**Interfaces:**
- Consumes: `optimizationResultSchema`, `OptimizationResult`, `OptimizeRequest`, `AiProvider` from `lib/ai/types.ts` (Task 1).
- Produces: `ClaudeProvider.optimizeResume()` now returns an `OptimizationResult` whose `resumeData` is populated from a single API call. `ClaudeProvider` no longer has an `extractStructuredResume` method.

- [ ] **Step 1: Replace `lib/ai/providers/claude.ts` in full**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AiProvider, OptimizeRequest, OptimizationResult } from "../types";
import { optimizationResultSchema } from "../types";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

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

function stripUnsupportedConstraints(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupportedConstraints);
  if (node !== null && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (obj.type === "number" && (k === "minimum" || k === "maximum")) continue;
      result[k] = stripUnsupportedConstraints(v);
    }
    return result;
  }
  return node;
}

function buildOutputSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(optimizationResultSchema) as Record<string, unknown>;
  delete schema.$schema;
  return stripUnsupportedConstraints(schema) as Record<string, unknown>;
}

export class ClaudeProvider implements AiProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async optimizeResume(request: OptimizeRequest): Promise<OptimizationResult> {
    const userContent = JSON.stringify({
      jobDescription: request.jobDescription,
      sections: request.sections,
    });

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 12000,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: buildOutputSchema() },
      },
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude did not return a text block with the optimization result");
    }

    return optimizationResultSchema.parse(JSON.parse(textBlock.text));
  }
}
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`

Expected: same single error as after Task 1 (`route.ts`'s `extractStructuredResume` call) — no new errors from `claude.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/providers/claude.ts
git commit -m "feat: merge Claude optimize+extract into a single API call"
```

---

### Task 3: Wrap OpenRouter's two-call flow behind the same interface

**Files:**
- Modify: `lib/ai/providers/openrouter.ts`

**Interfaces:**
- Consumes: `optimizationResultSchema`, `OptimizationResult`, `OptimizeRequest`, `AiProvider` from `lib/ai/types.ts` (Task 1).
- Produces: `OpenRouterProvider.optimizeResume()` returns an `OptimizationResult` with `resumeData` populated, doing two fetches internally. `extractStructuredResume` becomes a `private` method, no longer part of the public/interface surface.

- [ ] **Step 1: Replace `lib/ai/providers/openrouter.ts` in full**

```ts
import type { AiProvider, OptimizeRequest, OptimizationResult } from "../types";
import { optimizationResultSchema } from "../types";
import { ResumeDataSchema } from "../../../types/resume.types";
import type { ResumeData } from "../../../types/resume.types";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

const SYSTEM_PROMPT = `You are an expert resume editor specializing in ATS (Applicant Tracking System) optimization.
You will be given a resume broken into text sections (each with an id) and a target job description.
Rewrite each section's text to better align with the job description's language, keywords, and requirements.

Rules:
- Never fabricate experience, employers, dates, degrees, or skills the candidate doesn't have.
- Keep each rewritten section roughly the same length as the original — you are reframing, not expanding.
- Preserve names, contact info, dates, and section headings essentially as written.
- Return optimizedText for every section id you were given, even if unchanged.
- Estimate an ATS match score (0-100) for the optimized resume against the job description, and list matched and missing keywords.

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.
The JSON must match this exact structure:
{
  "sections": [{ "id": "string", "optimizedText": "string" }],
  "atsScore": number (0-100),
  "matchedKeywords": ["string"],
  "missingKeywords": ["string"],
  "summaryOfChanges": { "headline": "string", "bullets": ["string"] }
}`;

const rewriteResultSchema = optimizationResultSchema.omit({ resumeData: true });

export class OpenRouterProvider implements AiProvider {
  private apiKey: string;

  constructor() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY environment variable is not set");
    this.apiKey = key;
  }

  async optimizeResume(request: OptimizeRequest): Promise<OptimizationResult> {
    const userContent = JSON.stringify({
      jobDescription: request.jobDescription,
      sections: request.sections,
    });

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Resume Optimizer",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${body}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response");

    const rewritten = rewriteResultSchema.parse(JSON.parse(content));
    const resumeData = await this.extractStructuredResume(rewritten.sections);

    return { ...rewritten, resumeData };
  }

  private async extractStructuredResume(
    optimizedSections: Array<{ id: string; optimizedText: string }>
  ): Promise<ResumeData> {
    const extractionSystemPrompt = `You are a resume parser. Extract structured information from the provided resume text segments and return it as JSON.

Rules:
- Contact info (name, email, phone, location, optional: linkedin/github/website) comes from the opening segments
- Extract each job as an experience entry: title, company, location, startDate, endDate, and an array of bullet strings (strip bullet symbols)
- Extract each education entry: institution, degree, field, graduationDate
- If projects exist, extract them with name, description, technologies array, and bullets array
- If a skills section exists, classify into languages, frameworks, tools, other (each an array of strings)
- If any other section exists that doesn't fit the schema, add it as a customSections entry with label and content
- Dates should be kept as written (e.g. "Jan 2020", "2019 – Present")
- Omit optional fields rather than returning empty strings

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.
The JSON must match this exact structure:
{
  "contact": { "name": "string", "email": "string", "phone": "string", "location": "string", "linkedin": "string (optional)", "github": "string (optional)", "website": "string (optional)" },
  "summary": "string (optional)",
  "experience": [{ "title": "string", "company": "string", "location": "string (optional)", "startDate": "string", "endDate": "string", "bullets": ["string"] }],
  "education": [{ "institution": "string", "degree": "string", "field": "string (optional)", "graduationDate": "string" }],
  "projects": [{ "name": "string", "description": "string (optional)", "technologies": ["string"], "bullets": ["string"] }],
  "skills": { "languages": ["string"], "frameworks": ["string"], "tools": ["string"], "other": ["string"] },
  "customSections": [{ "label": "string", "content": "string" }]
}`;

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Resume Optimizer",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: extractionSystemPrompt },
          { role: "user", content: JSON.stringify(optimizedSections) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${body}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response");

    return ResumeDataSchema.parse(JSON.parse(content));
  }
}
```

- [ ] **Step 2: Run the type checker**

Run: `npx tsc --noEmit`

Expected: same single error as after Task 1/2 (`route.ts`'s `extractStructuredResume` call) — no new errors from `openrouter.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/providers/openrouter.ts
git commit -m "feat: expose OpenRouter's two-call flow through the single optimizeResume interface"
```

---

### Task 4: Simplify the route and verify end-to-end

**Files:**
- Modify: `app/api/optimize/route.ts`

**Interfaces:**
- Consumes: `AiProvider.optimizeResume()` returning `OptimizationResult` with `resumeData` (Tasks 1-3).

- [ ] **Step 1: Replace `app/api/optimize/route.ts` in full**

```ts
import { NextRequest, NextResponse } from "next/server";
import { parseDocx } from "@/lib/parsing/docx";
import { extractPdfText } from "@/lib/parsing/pdf";
import { sectionsFromDocxSegments, sectionsFromPlainText } from "@/lib/parsing/extractSections";
import { getAiProvider } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("resume");
  const jobDescription = form.get("jobDescription");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing resume file" }, { status: 400 });
  }
  if (typeof jobDescription !== "string" || !jobDescription.trim()) {
    return NextResponse.json({ error: "Missing job description" }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  const isDocx = lowerName.endsWith(".docx");
  const isPdf = lowerName.endsWith(".pdf");

  if (!isDocx && !isPdf) {
    return NextResponse.json({ error: "Only .docx and .pdf resumes are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const sections = isDocx
    ? sectionsFromDocxSegments((await parseDocx(buffer)).segments)
    : sectionsFromPlainText(await extractPdfText(buffer));

  if (sections.length === 0) {
    return NextResponse.json({ error: "Couldn't find any readable text in that file" }, { status: 400 });
  }

  const ai = getAiProvider();
  let result;
  console.time("Optimizing resume with AI");
  try {
    result = await ai.optimizeResume({ sections, jobDescription });
  } catch (err) {
    console.error("AI optimization failed", err);
    return NextResponse.json({ error: "Resume optimization failed. Please try again." }, { status: 502 });
  }
  console.timeEnd("Optimizing resume with AI");

  return NextResponse.json({
    atsScore: result.atsScore,
    matchedKeywords: result.matchedKeywords,
    missingKeywords: result.missingKeywords,
    summaryOfChanges: result.summaryOfChanges,
    resumeData: result.resumeData,
  });
}
```

- [ ] **Step 2: Run the type checker and confirm zero errors**

Run: `npx tsc --noEmit`

Expected: no output, exit code 0.

- [ ] **Step 3: Run the linter**

Run: `npm run lint`

Expected: no errors (warnings pre-existing on unrelated files are acceptable; there should be none new in the four files touched by this plan).

- [ ] **Step 4: Manual end-to-end test against Claude (`AI_PROVIDER=claude`, the current `.env.local` default)**

Run: `npm run dev`, then open `http://localhost:3000` in a browser. Upload a real `.docx` resume, paste a job description, and submit.

Expected:
- The request completes and `ResultView` renders `atsScore`, matched/missing keyword lists, `summaryOfChanges`, and a populated resume template (proves `resumeData` came back correctly).
- The terminal log for `Optimizing resume with AI` (from `console.time`/`console.timeEnd` in `route.ts`) shows a single combined duration, and it should be noticeably under the old two-call ~100s total (a single Claude call carrying more output tokens will take longer than the old 60s first call alone, but should still land well short of 100s — treat >90s as a signal something regressed, e.g. schema bloat or model retries).
- Repeat with a `.pdf` resume upload to confirm the PDF path also works.

If the request instead fails with a 502 and the server log shows a JSON parse error mentioning truncated or incomplete JSON, the combined response exceeded `max_tokens: 12000` in `lib/ai/providers/claude.ts` (Task 2) — raise that value (e.g. to 16000) and rerun this step.

- [ ] **Step 5: Manual end-to-end test against OpenRouter**

Temporarily set `AI_PROVIDER=openrouter` in `.env.local`, restart `npm run dev`, and repeat the same docx upload test.

Expected: same successful result shape as Step 4 (this path still does two internal fetches, so timing is unchanged from before this plan — the goal here is just confirming `OpenRouterProvider.optimizeResume()` still returns a valid `resumeData`, not a speedup).

Afterward, set `AI_PROVIDER` back to `claude` in `.env.local` to restore the original local configuration.

- [ ] **Step 6: Commit**

```bash
git add app/api/optimize/route.ts
git commit -m "feat: simplify /api/optimize to a single AI call"
```
