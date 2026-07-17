# Score, Then Optimize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the current one-shot `/api/optimize` call into two phases:
score the original resume and save it immediately, then let the user
trigger the actual rewrite later from the application's detail page,
where it's shown as a before/after comparison.

**Architecture:** A new `AiProvider.scoreResume` method scores the
resume as given (no rewrite) and suggests improvements. `POST
/api/score` (replacing `/api/optimize`'s old role) calls it and creates
an `Application` in a "scored" state — `resumeData` left `null`, with a
frozen snapshot (`originalSections`) of the parsed resume and a frozen
`original*` baseline (score/keywords) that's never overwritten. A
rewritten `POST /api/optimize` takes `{ applicationId }`, runs the
existing `optimizeResume` against that frozen snapshot, and updates the
row's "current" score/keywords/resumeData/summary. The detail page
branches on `resumeData === null`: `ScoringView` (score, keywords,
suggestions, an Optimize button) before, the updated `ResultView`
(before → after comparison, keywords added vs. still missing, summary,
download) after.

**Tech Stack:** Next.js 16 (App Router, Node runtime), Prisma + Postgres,
existing `AiProvider` abstraction (`ClaudeProvider`/`OpenRouterProvider`)
— no new packages required.

## Global Constraints

- `resumeData == null` is the sole signal for "scored, not yet
  optimized" vs. "optimized" — no separate status enum.
- `originalSections`, `originalAtsScore`, `originalMatchedKeywords`,
  `originalMissingKeywords`, `suggestionsHeadline`, `suggestionsBullets`
  are frozen at scoring time and **never** overwritten by `/api/optimize`
  — they're the permanent "before" baseline for the comparison UI.
- `atsScore`/`matchedKeywords`/`missingKeywords` are the "current" state:
  set equal to the original values at scoring time, then overwritten
  each time `/api/optimize` runs.
- `resumeData`/`summaryHeadline`/`summaryBullets` stay `null` until
  `/api/optimize` has run at least once.
- Re-running `/api/optimize` on an already-optimized application is
  allowed (re-optimizes against the same frozen `originalSections`) —
  there's no UI entry point for it yet, but the endpoint doesn't reject
  it.
- Every route calls `requireAuth()` as its first statement; ownership
  checks on `/api/optimize` and `/api/applications/:id` return 404 (not
  401/403) for a foreign id, matching the existing pattern.
- No automated test runner exists in this repo; every task is verified
  manually via `curl` and/or the browser.
- The dev database's existing `Application` rows (all test data from
  prior manual testing) are cleared before the migration, since they
  predate the new required columns and there's no real user data to
  preserve.

---

### Task 1: Prisma schema migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: the expanded `Application` model — every later task's
  `prisma.application.*` calls rely on these exact field names.

- [ ] **Step 1: Clear existing test `Application` rows**

Create `tmp-clear-applications.ts` in the project root:

```ts
import { prisma } from "./lib/prisma";

async function main() {
  const { count } = await prisma.application.deleteMany({});
  console.log(`Deleted ${count} existing Application rows`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});
```

Run it, then delete the script:

```bash
export DATABASE_URL=$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2-)
npx tsx tmp-clear-applications.ts
rm tmp-clear-applications.ts
```

Expected: prints `Deleted N existing Application rows`.

- [ ] **Step 2: Update the `Application` model**

Modify `prisma/schema.prisma` — replace the existing `Application` model
with:

```prisma
model Application {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  companyName     String
  roleTitle       String
  jobDescription  String

  // Frozen snapshot from the scoring step — never overwritten.
  originalSections        Json
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

- [ ] **Step 3: Run the migration**

```bash
export DATABASE_URL=$(grep -m1 '^DATABASE_URL=' .env.local | cut -d= -f2-)
npx prisma migrate dev --name score_then_optimize
```

Expected: prints `Your database is now in sync with your schema` and
creates `prisma/migrations/<timestamp>_score_then_optimize/migration.sql`.
If it fails complaining about a NOT NULL column on existing data, Step 1
wasn't run (or a new row was created since) — rerun Step 1 and retry.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add score/optimize fields to Application model"
```

---

### Task 2: `scoreResume` on the AI provider

**Files:**
- Modify: `lib/ai/types.ts`
- Modify: `lib/ai/providers/claude.ts`
- Modify: `lib/ai/providers/openrouter.ts`

**Interfaces:**
- Produces: `scoreResultSchema`/`ScoreResult` from `lib/ai/types.ts`, and
  `scoreResume(request: OptimizeRequest): Promise<ScoreResult>` added to
  the `AiProvider` interface and implemented by both providers — used by
  `app/api/score/route.ts` (Task 3).

- [ ] **Step 1: Add `scoreResultSchema`/`ScoreResult` and the interface method**

Modify `lib/ai/types.ts` — add after `optimizationResultSchema`/
`OptimizationResult`:

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
```

Change the `AiProvider` interface to:

```ts
export interface AiProvider {
  scoreResume(request: OptimizeRequest): Promise<ScoreResult>;
  optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>;
}
```

- [ ] **Step 2: Implement `scoreResume` in `lib/ai/providers/claude.ts`**

Add this constant near `SYSTEM_PROMPT`:

```ts
const SCORE_SYSTEM_PROMPT = `You are an expert resume reviewer specializing in ATS (Applicant Tracking System) compatibility.
You will be given a resume broken into text sections (each with an id) and a target job description.

Do NOT rewrite or edit the resume. Only evaluate it exactly as given.

1. Estimate an ATS match score (0-100) for the resume exactly as written against the job description.
2. List keywords from the job description the resume already matches, and keywords it's missing.
3. Suggest concrete improvements the candidate could make — a short headline plus specific bullet points (e.g. keywords to work in, weak phrasing to strengthen, missing quantifiable results). Never suggest inventing experience or skills the candidate doesn't have — suggestions are about how they present what they already have.`;
```

Generalize `buildOutputSchema` to accept any zod schema (it currently
hardcodes `optimizationResultSchema`):

```ts
function buildOutputSchema(zodSchema: z.ZodTypeAny): Record<string, unknown> {
  const schema = z.toJSONSchema(zodSchema) as Record<string, unknown>;
  delete schema.$schema;
  return stripUnsupportedConstraints(schema) as Record<string, unknown>;
}
```

Update the import line to also bring in `scoreResultSchema`/`ScoreResult`:

```ts
import type { AiProvider, OptimizeRequest, OptimizationResult, ScoreResult } from "../types";
import { optimizationResultSchema, scoreResultSchema } from "../types";
```

Update the two existing call sites of `buildOutputSchema()` (inside
`optimizeResume`) to `buildOutputSchema(optimizationResultSchema)`, and
add the new method to the class, right after `optimizeResume`:

```ts
  async scoreResume(request: OptimizeRequest): Promise<ScoreResult> {
    const userContent = JSON.stringify({
      jobDescription: request.jobDescription,
      sections: request.sections,
    });

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SCORE_SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: buildOutputSchema(scoreResultSchema) },
      },
      messages: [{ role: "user", content: userContent }],
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "Claude's response was truncated (hit max_tokens) before completing the score result"
      );
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude did not return a text block with the score result");
    }

    return scoreResultSchema.parse(JSON.parse(textBlock.text));
  }
```

- [ ] **Step 3: Implement `scoreResume` in `lib/ai/providers/openrouter.ts`**

Update the import line:

```ts
import type { AiProvider, OptimizeRequest, OptimizationResult, ScoreResult } from "../types";
import { optimizationResultSchema, scoreResultSchema } from "../types";
```

Add this constant near `SYSTEM_PROMPT`:

```ts
const SCORE_SYSTEM_PROMPT = `You are an expert resume reviewer specializing in ATS (Applicant Tracking System) compatibility.
You will be given a resume broken into text sections (each with an id) and a target job description.

Do NOT rewrite or edit the resume. Only evaluate it exactly as given.

1. Estimate an ATS match score (0-100) for the resume exactly as written against the job description.
2. List keywords from the job description the resume already matches, and keywords it's missing.
3. Suggest concrete improvements the candidate could make — a short headline plus specific bullet points (e.g. keywords to work in, weak phrasing to strengthen, missing quantifiable results). Never suggest inventing experience or skills the candidate doesn't have — suggestions are about how they present what they already have.

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.
The JSON must match this exact structure:
{
  "atsScore": number (0-100),
  "matchedKeywords": ["string"],
  "missingKeywords": ["string"],
  "suggestions": { "headline": "string", "bullets": ["string"] }
}`;
```

Add the method to the class, right after `optimizeResume`:

```ts
  async scoreResume(request: OptimizeRequest): Promise<ScoreResult> {
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
          { role: "system", content: SCORE_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
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

    return scoreResultSchema.parse(JSON.parse(content));
  }
```

- [ ] **Step 4: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 5: Verify `scoreResume` against the real configured provider**

Create `tmp-score-check.ts` in the project root:

```ts
import { getAiProvider } from "./lib/ai/provider";

async function main() {
  const ai = getAiProvider();
  const result = await ai.scoreResume({
    sections: [
      { id: "s1", heading: null, originalText: "Jane Doe, jane@example.com" },
      { id: "s2", heading: "EXPERIENCE", originalText: "Software Engineer at Acme, 2020-2024. Built internal tools in Python." },
    ],
    jobDescription: "Looking for a backend engineer with Node.js and Postgres experience.",
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error("ERROR", e);
  process.exit(1);
});
```

Run it, then delete the script:

```bash
npx tsx tmp-score-check.ts
rm tmp-score-check.ts
```

Expected: prints a JSON object with `atsScore` (0-100), `matchedKeywords`,
`missingKeywords`, and `suggestions: { headline, bullets }` — no
`sections` or `resumeData` fields (those belong to `optimizeResume`,
not this call).

- [ ] **Step 6: Commit**

```bash
git add lib/ai/types.ts lib/ai/providers/claude.ts lib/ai/providers/openrouter.ts
git commit -m "feat: add scoreResume to the AI provider interface"
```

---

### Task 3: `POST /api/score` and pointing the new-application flow at it

**Files:**
- Create: `app/api/score/route.ts`
- Modify: `app/applications/new/page.tsx`

**Interfaces:**
- Consumes: `scoreResume` (Task 2), `prisma`, `requireAuth`,
  `getAiProvider`, `parseDocx`, `extractPdfText`,
  `sectionsFromDocxSegments`/`sectionsFromPlainText` — all existing.
- Produces: `POST /api/score`, returning `{ applicationId, atsScore,
  matchedKeywords, missingKeywords, suggestions }` — consumed by
  `app/applications/new/page.tsx` (this task) and later by the detail
  page's initial fetch (Task 5/6, via `GET /api/applications/:id`).

- [ ] **Step 1: Write `app/api/score/route.ts`**

This is the current `app/api/optimize/route.ts` with the AI call and
persistence swapped for scoring:

```ts
import { NextRequest, NextResponse } from "next/server";
import { parseDocx } from "@/lib/parsing/docx";
import { extractPdfText } from "@/lib/parsing/pdf";
import { sectionsFromDocxSegments, sectionsFromPlainText } from "@/lib/parsing/extractSections";
import { getAiProvider } from "@/lib/ai/provider";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const form = await req.formData();
  const jobDescription = form.get("jobDescription");
  const companyName = form.get("companyName");
  const roleTitle = form.get("roleTitle");
  const useMaster = form.get("useMaster") === "true";
  const saveAsMaster = form.get("saveAsMaster") === "true";
  const uploadedFile = form.get("resume");

  if (typeof jobDescription !== "string" || !jobDescription.trim()) {
    return NextResponse.json({ error: "Missing job description" }, { status: 400 });
  }
  if (typeof companyName !== "string" || !companyName.trim()) {
    return NextResponse.json({ error: "Missing company name" }, { status: 400 });
  }
  if (typeof roleTitle !== "string" || !roleTitle.trim()) {
    return NextResponse.json({ error: "Missing role title" }, { status: 400 });
  }

  let fileName: string;
  let mimeType: string;
  let buffer: Buffer;

  if (useMaster) {
    const masterResume = await prisma.masterResume.findUnique({ where: { userId } });
    if (!masterResume) {
      return NextResponse.json({ error: "No master resume on file" }, { status: 400 });
    }
    fileName = masterResume.fileName;
    mimeType = masterResume.mimeType;
    buffer = Buffer.from(masterResume.fileData);
  } else {
    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: "Missing resume file" }, { status: 400 });
    }
    fileName = uploadedFile.name;
    mimeType = uploadedFile.type;
    buffer = Buffer.from(await uploadedFile.arrayBuffer());
  }

  const lowerName = fileName.toLowerCase();
  const isDocx = lowerName.endsWith(".docx");
  const isPdf = lowerName.endsWith(".pdf");

  if (!isDocx && !isPdf) {
    return NextResponse.json({ error: "Only .docx and .pdf resumes are supported" }, { status: 400 });
  }

  if (!useMaster && saveAsMaster) {
    const fileData = new Uint8Array(buffer);
    await prisma.masterResume.upsert({
      where: { userId },
      create: { userId, fileName, mimeType, fileData },
      update: { fileName, mimeType, fileData },
    });
  }

  const sections = isDocx
    ? sectionsFromDocxSegments((await parseDocx(buffer)).segments)
    : sectionsFromPlainText(await extractPdfText(buffer));

  if (sections.length === 0) {
    return NextResponse.json({ error: "Couldn't find any readable text in that file" }, { status: 400 });
  }

  const ai = getAiProvider();
  let result;
  console.time("Scoring resume with AI");
  try {
    result = await ai.scoreResume({ sections, jobDescription });
  } catch (err) {
    console.error("AI scoring failed", err);
    return NextResponse.json({ error: "Resume scoring failed. Please try again." }, { status: 502 });
  } finally {
    console.timeEnd("Scoring resume with AI");
  }

  const application = await prisma.application.create({
    data: {
      userId,
      companyName: companyName.trim(),
      roleTitle: roleTitle.trim(),
      jobDescription,
      originalSections: sections,
      originalAtsScore: result.atsScore,
      originalMatchedKeywords: result.matchedKeywords,
      originalMissingKeywords: result.missingKeywords,
      suggestionsHeadline: result.suggestions.headline,
      suggestionsBullets: result.suggestions.bullets,
      atsScore: result.atsScore,
      matchedKeywords: result.matchedKeywords,
      missingKeywords: result.missingKeywords,
    },
  });

  return NextResponse.json({
    applicationId: application.id,
    atsScore: result.atsScore,
    matchedKeywords: result.matchedKeywords,
    missingKeywords: result.missingKeywords,
    suggestions: result.suggestions,
  });
}
```

- [ ] **Step 2: Point the new-application flow at `/api/score`**

In `app/applications/new/page.tsx`, change:

```tsx
      const res = await authFetch("/api/optimize", { method: "POST", body: formData });
```

to:

```tsx
      const res = await authFetch("/api/score", { method: "POST", body: formData });
```

- [ ] **Step 3: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 4: Verify with curl**

```bash
npm run dev > /tmp/dev-server.log 2>&1 &
disown
sleep 5

curl -i http://localhost:3000/api/score
```

Expected: `HTTP/1.1 401`.

```bash
SIGNUP=$(curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"score-test@example.com","password":"correct-horse"}')
TOKEN=$(echo "$SIGNUP" | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

RESUME_FIXTURE=/path/to/any/resume.docx   # substitute a real .docx or .pdf

RESPONSE=$(curl -s -X POST http://localhost:3000/api/score \
  -H "Authorization: Bearer $TOKEN" \
  -F "companyName=Acme Corp" \
  -F "roleTitle=Backend Engineer" \
  -F "jobDescription=We need a backend engineer with Node.js and Postgres experience." \
  -F "useMaster=false" \
  -F "saveAsMaster=true" \
  -F "resume=@$RESUME_FIXTURE")
echo "$RESPONSE"
APP_ID=$(echo "$RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).applicationId")
echo "APP_ID=$APP_ID"
```

Expected: `$RESPONSE` is a `HTTP 200` JSON body with `applicationId`,
`atsScore`, `matchedKeywords`, `missingKeywords`, `suggestions: {
headline, bullets }` — no `resumeData` field in this response at all
(it's not returned by `/api/score`). Tasks 4 and 5 create their own test
applications rather than depending on `$APP_ID` from this step, since
shell variables don't persist across separate command invocations.

- [ ] **Step 5: Commit**

```bash
git add app/api/score/route.ts app/applications/new/page.tsx
git commit -m "feat: add POST /api/score, replacing /api/optimize's creation role"
```

---

### Task 4: Rewrite `POST /api/optimize` to take `{ applicationId }`

**Files:**
- Modify: `app/api/optimize/route.ts` (full rewrite)

**Interfaces:**
- Consumes: `optimizeResume` (existing), `prisma`, `requireAuth`,
  `SectionInput` type (`lib/ai/types.ts`).
- Produces: `POST /api/optimize` with JSON body `{ applicationId:
  string }`, returning the same detail shape as `GET
  /api/applications/:id` (Task 5) — consumed by the detail page's
  "Optimize" button (Task 6).

- [ ] **Step 1: Replace the contents of `app/api/optimize/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai/provider";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import type { SectionInput } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const applicationId = (body as { applicationId?: unknown } | null)?.applicationId;
  if (typeof applicationId !== "string" || !applicationId) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application || application.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ai = getAiProvider();
  let result;
  console.time("Optimizing resume with AI");
  try {
    result = await ai.optimizeResume({
      sections: application.originalSections as unknown as SectionInput[],
      jobDescription: application.jobDescription,
    });
  } catch (err) {
    console.error("AI optimization failed", err);
    return NextResponse.json({ error: "Resume optimization failed. Please try again." }, { status: 502 });
  } finally {
    console.timeEnd("Optimizing resume with AI");
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      atsScore: result.atsScore,
      matchedKeywords: result.matchedKeywords,
      missingKeywords: result.missingKeywords,
      resumeData: result.resumeData,
      summaryHeadline: result.summaryOfChanges.headline,
      summaryBullets: result.summaryOfChanges.bullets,
    },
  });

  return NextResponse.json({
    id: updated.id,
    companyName: updated.companyName,
    roleTitle: updated.roleTitle,
    jobDescription: updated.jobDescription,
    resumeData: updated.resumeData,
    atsScore: updated.atsScore,
    matchedKeywords: updated.matchedKeywords,
    missingKeywords: updated.missingKeywords,
    summaryOfChanges: {
      headline: updated.summaryHeadline,
      bullets: updated.summaryBullets,
    },
    originalAtsScore: updated.originalAtsScore,
    originalMatchedKeywords: updated.originalMatchedKeywords,
    originalMissingKeywords: updated.originalMissingKeywords,
    suggestions: {
      headline: updated.suggestionsHeadline,
      bullets: updated.suggestionsBullets,
    },
    createdAt: updated.createdAt,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Verify with curl**

Env vars don't persist between separate shell invocations, so this
step re-derives its own `$TOKEN` and creates its own scored application
rather than depending on Task 3's — run it as one combined block:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"score-test@example.com","password":"correct-horse"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

curl -i -X POST http://localhost:3000/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -i -X POST http://localhost:3000/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"applicationId":"does-not-exist"}'

RESUME_FIXTURE=/path/to/any/resume.docx   # substitute a real .docx or .pdf
SCORE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/score \
  -H "Authorization: Bearer $TOKEN" \
  -F "companyName=Optimize Test Co" \
  -F "roleTitle=Backend Engineer" \
  -F "jobDescription=We need a backend engineer with Node.js and Postgres experience." \
  -F "useMaster=false" \
  -F "resume=@$RESUME_FIXTURE")
APP_ID=$(echo "$SCORE_RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).applicationId")
ORIGINAL_SCORE=$(echo "$SCORE_RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).atsScore")
echo "APP_ID=$APP_ID ORIGINAL_SCORE=$ORIGINAL_SCORE"

curl -s -X POST http://localhost:3000/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"applicationId\":\"$APP_ID\"}"
```

Expected, in order: `HTTP/1.1 400` (`{"error":"Missing applicationId"}`);
`HTTP/1.1 404`; then the final call returns `HTTP 200` JSON with a
populated `resumeData` object, a `summaryOfChanges` with
`headline`/`bullets`, and `originalAtsScore` equal to `$ORIGINAL_SCORE`
(unchanged by this call, even if `atsScore` itself differs after
optimizing).

- [ ] **Step 4: Commit**

```bash
git add app/api/optimize/route.ts
git commit -m "feat: rewrite POST /api/optimize to run against a scored Application"
```

---

### Task 5: Update `GET /api/applications/:id` response shape

**Files:**
- Modify: `app/api/applications/[id]/route.ts` (`GET` handler only)

**Interfaces:**
- Produces: `GET /api/applications/:id` now returns the same shape as
  `POST /api/optimize` (Task 4) — `resumeData`/`summaryOfChanges`
  nullable, plus `originalAtsScore`/`originalMatchedKeywords`/
  `originalMissingKeywords`/`suggestions` — consumed by the detail page
  (Task 6).

- [ ] **Step 1: Update the `GET` handler's response**

In `app/api/applications/[id]/route.ts`, replace the `GET` function's
return statement:

```ts
  return NextResponse.json({
    id: application.id,
    companyName: application.companyName,
    roleTitle: application.roleTitle,
    jobDescription: application.jobDescription,
    resumeData: application.resumeData,
    atsScore: application.atsScore,
    matchedKeywords: application.matchedKeywords,
    missingKeywords: application.missingKeywords,
    summaryOfChanges: application.summaryHeadline
      ? { headline: application.summaryHeadline, bullets: application.summaryBullets }
      : null,
    originalAtsScore: application.originalAtsScore,
    originalMatchedKeywords: application.originalMatchedKeywords,
    originalMissingKeywords: application.originalMissingKeywords,
    suggestions: {
      headline: application.suggestionsHeadline,
      bullets: application.suggestionsBullets,
    },
    createdAt: application.createdAt,
  });
```

(The `DELETE` handler and `loadOwnedApplication` helper are unchanged.)

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Verify with curl**

Self-contained (re-derives `$TOKEN` and creates its own applications —
run as one combined block):

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"score-test@example.com","password":"correct-horse"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

RESUME_FIXTURE=/path/to/any/resume.docx   # substitute a real .docx or .pdf

# Application 1: score, then optimize — resumeData should be populated
SCORE_1=$(curl -s -X POST http://localhost:3000/api/score \
  -H "Authorization: Bearer $TOKEN" \
  -F "companyName=Detail Route Test 1" -F "roleTitle=Engineer" \
  -F "jobDescription=Backend role requiring Node.js." \
  -F "useMaster=false" -F "resume=@$RESUME_FIXTURE")
APP_ID_1=$(echo "$SCORE_1" | node -pe "JSON.parse(require('fs').readFileSync(0)).applicationId")
curl -s -X POST http://localhost:3000/api/optimize \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"applicationId\":\"$APP_ID_1\"}" > /dev/null

curl -s http://localhost:3000/api/applications/$APP_ID_1 -H "Authorization: Bearer $TOKEN"

# Application 2: score only, never optimized — resumeData should be null
SCORE_2=$(curl -s -X POST http://localhost:3000/api/score \
  -H "Authorization: Bearer $TOKEN" \
  -F "companyName=Detail Route Test 2" -F "roleTitle=Engineer" \
  -F "jobDescription=Frontend role requiring React." \
  -F "useMaster=false" -F "resume=@$RESUME_FIXTURE")
APP_ID_2=$(echo "$SCORE_2" | node -pe "JSON.parse(require('fs').readFileSync(0)).applicationId")

curl -s http://localhost:3000/api/applications/$APP_ID_2 -H "Authorization: Bearer $TOKEN"
```

Expected: the first `GET` shows `resumeData` and `summaryOfChanges`
populated, plus `originalAtsScore`/`originalMatchedKeywords`/
`originalMissingKeywords`/`suggestions` present. The second `GET` shows
`resumeData: null`, `summaryOfChanges: null`, with
`originalAtsScore`/`suggestions` still populated.

- [ ] **Step 4: Commit**

```bash
git add "app/api/applications/[id]/route.ts"
git commit -m "feat: include original score/keywords and suggestions in application detail"
```

---

### Task 6: `ScoringView`, updated `ResultView`, and the detail page

**Files:**
- Create: `components/ScoringView.tsx`
- Modify: `components/ResultView.tsx`
- Modify: `app/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: nothing new from earlier tasks besides the response shapes
  from Tasks 4/5.
- Produces: `ScoringView` (props: `atsScore`, `matchedKeywords`,
  `missingKeywords`, `suggestions: { headline, bullets }`, `onOptimize:
  () => void`, `optimizing: boolean`, `error: string | null`) and the
  updated `ResultView` (adds required `previousAtsScore: number` and
  `previousMissingKeywords: string[]` props) — both used only by
  `app/applications/[id]/page.tsx` in this task.

- [ ] **Step 1: Write `components/ScoringView.tsx`**

```tsx
"use client";

interface ScoringViewProps {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: { headline: string; bullets: string[] };
  onOptimize: () => void;
  optimizing: boolean;
  error: string | null;
}

export function ScoringView({
  atsScore,
  matchedKeywords,
  missingKeywords,
  suggestions,
  onOptimize,
  optimizing,
  error,
}: ScoringViewProps) {
  return (
    <div className="space-y-6">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4 w-fit">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">ATS alignment</p>
        <p className="text-2xl sm:text-3xl font-medium text-gray-800 dark:text-white">
          {atsScore}<span className="text-sm text-gray-400 ml-1">/100</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Matched keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {matchedKeywords.map((kw) => (
              <span key={kw} className="bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Missing keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {missingKeywords.map((kw) => (
              <span key={kw} className="bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 text-xs px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4 space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Suggested improvements</p>
        <p className="text-sm font-medium text-gray-800 dark:text-white leading-relaxed">{suggestions.headline}</p>
        <ul className="space-y-1.5">
          {suggestions.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 shrink-0" />
              <span className="leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onOptimize}
        disabled={optimizing}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
      >
        {optimizing ? "Optimizing..." : "Optimize this resume"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update `components/ResultView.tsx`**

Change the props interface:

```tsx
interface ResultViewProps {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: { headline: string; bullets: string[] };
  resumeData: ResumeData;
  previousAtsScore: number;
  previousMissingKeywords: string[];
  onRestart: () => void;
}
```

Update the function signature to destructure the two new props:

```tsx
export function ResultView({
  atsScore,
  matchedKeywords,
  missingKeywords,
  summaryOfChanges,
  resumeData,
  previousAtsScore,
  previousMissingKeywords,
  onRestart,
}: ResultViewProps) {
  const [templateId, setTemplateId] = useState("modern");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const keywordsAdded = matchedKeywords.filter((kw) => previousMissingKeywords.includes(kw));
```

Replace the "ATS score cards" block (the one with the commented-out
"before" card) with:

```tsx
      {/* ATS score comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">ATS alignment before</p>
          <p className="text-2xl sm:text-3xl font-medium text-gray-500 dark:text-gray-400">
            {previousAtsScore}<span className="text-sm text-gray-400 ml-1">/100</span>
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">ATS alignment after</p>
          <p className="text-2xl sm:text-3xl font-medium text-green-600">
            {atsScore}<span className="text-sm text-gray-400 ml-1">/100</span>
          </p>
        </div>
      </div>
```

Replace the "Keywords" block's two card labels/data — "Matched
keywords" (using `matchedKeywords`) becomes "Keywords added" (using
`keywordsAdded`), and "Missing keywords" becomes "Still missing" (same
`missingKeywords` data, just relabeled):

```tsx
      {/* Keywords */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Keywords added</p>
          <div className="flex flex-wrap gap-1.5">
            {keywordsAdded.map((kw) => (
              <span key={kw} className="bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-300 text-xs px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Still missing</p>
          <div className="flex flex-wrap gap-1.5">
            {missingKeywords.map((kw) => (
              <span key={kw} className="bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 text-xs px-2 py-0.5 rounded-full">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>
```

Everything else in the file (`handleDownload`, "What changed", template
selector, action row) is unchanged.

- [ ] **Step 3: Update `app/applications/[id]/page.tsx`**

Replace the whole file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ResultView } from "@/components/ResultView";
import { ScoringView } from "@/components/ScoringView";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ResumeData } from "@/types/resume.types";

interface ApplicationDetail {
  id: string;
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  resumeData: ResumeData | null;
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: { headline: string; bullets: string[] } | null;
  originalAtsScore: number;
  originalMatchedKeywords: string[];
  originalMissingKeywords: string[];
  suggestions: { headline: string; bullets: string[] };
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { accessToken, ready } = useAuth();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !accessToken) {
      router.push("/login");
    }
  }, [ready, accessToken, router]);

  useEffect(() => {
    if (!accessToken) return;
    authFetch(`/api/applications/${params.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Application not found");
        setApplication(await res.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load application"));
  }, [accessToken, params.id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await authFetch(`/api/applications/${params.id}`, { method: "DELETE" });
      router.push("/");
    } finally {
      setDeleting(false);
    }
  }

  async function handleOptimize() {
    setOptimizing(true);
    setOptimizeError(null);
    try {
      const res = await authFetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: params.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Optimization failed");
      }
      setApplication(await res.json());
    } catch (err) {
      setOptimizeError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setOptimizing(false);
    }
  }

  if (!ready || !accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-medium text-gray-900 dark:text-white">
            Resume<span className="text-blue-600">Tailor</span>
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {!application && !error && <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>}

        {application && (
          <>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {application.companyName}
              </p>
              <h1 className="text-lg font-medium text-gray-900 dark:text-white">{application.roleTitle}</h1>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete this application"}
              </button>
            </div>

            {application.resumeData === null ? (
              <ScoringView
                atsScore={application.atsScore}
                matchedKeywords={application.matchedKeywords}
                missingKeywords={application.missingKeywords}
                suggestions={application.suggestions}
                onOptimize={handleOptimize}
                optimizing={optimizing}
                error={optimizeError}
              />
            ) : (
              <ResultView
                atsScore={application.atsScore}
                matchedKeywords={application.matchedKeywords}
                missingKeywords={application.missingKeywords}
                summaryOfChanges={application.summaryOfChanges!}
                resumeData={application.resumeData}
                previousAtsScore={application.originalAtsScore}
                previousMissingKeywords={application.originalMissingKeywords}
                onRestart={() => router.push("/")}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
```

(`application.summaryOfChanges!` — the non-null assertion is safe here:
`resumeData`/`summaryOfChanges` are always written together by
`/api/optimize`, so `resumeData !== null` implies `summaryOfChanges !==
null`, even though TypeScript can't derive that cross-field invariant
from the `resumeData === null` check alone.)

- [ ] **Step 4: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 5: Verify with curl + a browser check**

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"score-test@example.com","password":"correct-horse"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")
RESUME_FIXTURE=/path/to/any/resume.docx   # substitute a real .docx or .pdf
SCORE_RESPONSE=$(curl -s -X POST http://localhost:3000/api/score \
  -H "Authorization: Bearer $TOKEN" \
  -F "companyName=Page Render Test" -F "roleTitle=Engineer" \
  -F "jobDescription=Backend role requiring Node.js." \
  -F "useMaster=false" -F "resume=@$RESUME_FIXTURE")
APP_ID=$(echo "$SCORE_RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).applicationId")
echo "Open this in a browser: http://localhost:3000/applications/$APP_ID"

curl -s -o /tmp/detail-page.html -w "%{http_code}\n" http://localhost:3000/applications/$APP_ID
```

Expected: `200` (confirms the page renders without a server error; data
loads client-side after hydration). Use the printed URL for the browser
check below.

With `npm run dev` running, open the printed URL
(`http://localhost:3000/applications/$APP_ID`) in a browser and confirm:
1. It shows `ScoringView` — score, matched/missing keywords, suggested
   improvements, an "Optimize this resume" button.
2. Clicking "Optimize" shows the loading state, then the page switches
   to `ResultView` showing before → after scores, "Keywords added"/
   "Still missing", the summary of changes, template picker, and a
   working "Download PDF".

- [ ] **Step 6: Commit**

```bash
git add components/ScoringView.tsx components/ResultView.tsx "app/applications/[id]/page.tsx"
git commit -m "feat: show scoring results and an Optimize step on the detail page"
```

---

### Task 7: Documentation

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update the "Request flow" list**

In `CLAUDE.md`, replace the numbered request-flow list (items 3-6,
covering `/api/optimize` through downloads) with:

```markdown
3. The browser POSTs `multipart/form-data` to `POST /api/score`
   (`app/api/score/route.ts`): `companyName`, `roleTitle`,
   `jobDescription`, `useMaster`, and either `resume` (override upload)
   or nothing (server loads the stored `MasterResume`).
4. The route parses the resume into `ResumeSection[]`, calls
   `getAiProvider().scoreResume(...)` (scores the *original* resume and
   suggests improvements — no rewrite), and on success persists an
   `Application` row in a "scored" state (`resumeData` left `null`)
   before returning the result plus its new `applicationId`.
5. The browser redirects to `/applications/:id`
   (`app/applications/[id]/page.tsx`), which fetches the record via
   `GET /api/applications/:id` and shows `ScoringView` (score, keywords,
   suggested improvements, an "Optimize this resume" button) while
   `resumeData` is still `null`.
6. Clicking "Optimize" POSTs `{ applicationId }` to `POST /api/optimize`
   (`app/api/optimize/route.ts`), which calls
   `getAiProvider().optimizeResume(...)` against the `Application`'s
   frozen `originalSections`, then updates the row's score/keywords/
   `resumeData`/summary — the original score/keywords are never
   overwritten, so the before/after comparison stays meaningful.
7. Once optimized, the detail page renders `ResultView`: before → after
   ATS score, keywords added vs. still missing, the summary of changes,
   template picker, and download button.
8. Downloads are unchanged: `ResultView` posts `resumeData` +
   `templateId` to `POST /api/resume/render`, which renders a PDF from
   scratch every time — nothing is ever stored as rendered bytes.
```

- [ ] **Step 2: Update the "Job applications and the master resume" bullet list**

In the same section, replace the bullet:

```markdown
- `app/api/master-resume/route.ts` — `GET` (metadata only) / `POST`
  (upload or replace) the user's master resume.
```

Keep it as-is, but add two new bullets right after it:

```markdown
- `app/api/score/route.ts` — `POST /api/score`, scores the original
  resume (no rewrite) and creates the `Application` in a "scored" state.
- `app/api/optimize/route.ts` — `POST /api/optimize`, takes
  `{ applicationId }` and runs the actual rewrite against a previously
  scored `Application`, leaving the original score/keywords untouched as
  the permanent "before" baseline.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the score-then-optimize flow"
```

---

### Task 8: Full manual walkthrough

**Files:** none — verification only, exercising Tasks 1–7 together.

- [ ] **Step 1: Fresh score → detail page shows scoring state**

1. `npm run dev` (if not already running).
2. Sign up with a brand-new email, create a new application through the
   full UI flow (`/applications/new`).
3. Confirm the detail page shows `ScoringView`: an ATS score, matched/
   missing keywords, and a "Suggested improvements" card — no download
   button, no template picker yet.

- [ ] **Step 2: Optimize from the detail page**

1. Click "Optimize this resume". Confirm a loading state appears.
2. Confirm the page then shows `ResultView`: "ATS alignment before" vs.
   "after", "Keywords added" vs. "Still missing", the "What changed"
   summary, template picker, and a working "Download PDF".
3. Reload the page — confirm the optimized state persists (loads from
   `GET /api/applications/:id`, not just client state).

- [ ] **Step 3: Re-optimize is allowed**

1. On the same, already-optimized application, hit
   `POST /api/optimize` again via curl with the same `applicationId`
   (there's no UI button for this yet, per the design's scope).
2. Confirm it succeeds and `originalAtsScore`/`originalMatchedKeywords`/
   `originalMissingKeywords` in the response are identical to what they
   were before this second call — only the "current" fields changed.

- [ ] **Step 4: Ownership and auth**

```bash
curl -i http://localhost:3000/api/score
curl -i -X POST http://localhost:3000/api/optimize -H "Content-Type: application/json" -d '{"applicationId":"x"}'
```

Expected: both `401`.

Using a second test account, confirm `POST /api/optimize` with the
first account's `applicationId` returns `404` (not the first account's
data).

- [ ] **Step 5: No commit for this task** — it's verification only. If
  any step fails, go back to the relevant task, fix it, and re-run this
  walkthrough from the top.
