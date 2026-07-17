# Job Applications (Multiple Resume Versions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user keep one reusable "master" resume and save every job
application (company, role, job description, tailored resume result) as
its own persistent record they can revisit, view, re-download, or delete.

**Architecture:** Two new Prisma models — `MasterResume` (one per user,
stores the original file bytes so it can be re-parsed later) and
`Application` (no file, just the AI's structured output —
`resumeData`/score/keywords/summary — exactly what `/api/optimize`
already returns). `/api/optimize` gains `companyName`/`roleTitle` and a
resume-source choice (`useMaster` or an override upload), and persists an
`Application` row on success. Downloads keep working exactly as they do
today, regenerated on demand from `resumeData` via the existing
`/api/resume/render` — nothing new is ever rendered to bytes and stored.
The home page (`app/page.tsx`) becomes a dashboard listing applications;
the existing 3-step upload flow moves to `/applications/new` with one new
step at the front; a new `/applications/[id]` page shows a saved result.

**Tech Stack:** Next.js 16 (App Router, Node runtime), Prisma + Postgres
(already provisioned — `DATABASE_URL` is set from the JWT auth work),
`react-dropzone` (already a dependency, used for file uploads), no new
packages required.

## Global Constraints

- `MasterResume` is one row per user (`userId` is `@unique`); uploading a
  new one overwrites it entirely — there is no version history.
- `Application` stores no file — only `resumeData` (Json), `atsScore`,
  `matchedKeywords`/`missingKeywords` (Json string arrays),
  `summaryHeadline`/`summaryBullets`. Even an override upload used just
  for one application is discarded after producing `resumeData`.
- `/api/optimize` only creates an `Application` row on a **successful**
  AI call — a failed optimization writes nothing.
- `GET`/`DELETE /api/applications/:id` return `404` (not 401/403) when
  the id belongs to another user or doesn't exist — no existence leakage.
- Every route (new and modified) calls `requireAuth()` as its first
  statement, exactly like every existing route in this codebase, and
  returns `{ "error": "Unauthorized" }` with status 401 on failure.
- Downloads are always regenerated on demand from `resumeData` via the
  existing, unmodified `/api/resume/render` — never stored as rendered
  bytes.
- No automated test runner exists in this repo (confirmed in
  `docs/superpowers/specs/2026-07-17-job-applications-design.md`); every
  task is verified manually via `curl` against the dev server and/or the
  browser.

---

## Before you start

Every verification step that needs a real uploaded file (master-resume
upload, a live optimize call) uses an env var so the commands below are
copy-pasteable:

```bash
export RESUME_FIXTURE=/absolute/path/to/any/resume.docx   # or .pdf
```

Point it at any `.docx` or `.pdf` resume you have locally — the same
kind of file you'd have used to manually test the original
`/api/optimize` flow. No database setup is needed: `DATABASE_URL` is
already configured from the JWT auth work, and `npx prisma migrate dev`
in Task 1 adds the new tables to that same database.

---

### Task 1: Prisma schema and migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing from earlier work — this modifies the existing
  `User` model and adds two new models.
- Produces: `MasterResume` and `Application` Prisma models — every later
  task's `prisma.masterResume.*` and `prisma.application.*` calls rely on
  these exact field names.

- [ ] **Step 1: Add the relation fields to `User` and the two new models**

Modify `prisma/schema.prisma` — add `masterResume` and `applications` to
the existing `User` model, and append the two new models:

```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  createdAt     DateTime       @default(now())
  refreshTokens RefreshToken[]
  masterResume  MasterResume?
  applications  Application[]
}
```

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
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  companyName     String
  roleTitle       String
  jobDescription  String
  resumeData      Json
  atsScore        Int
  matchedKeywords Json
  missingKeywords Json
  summaryHeadline String
  summaryBullets  Json
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([userId, createdAt])
}
```

(`RefreshToken` stays exactly as it is — only `User` gains the two new
relation fields shown above.)

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_master_resume_and_applications
```

Expected: prints `Your database is now in sync with your schema` and
creates
`prisma/migrations/<timestamp>_add_master_resume_and_applications/migration.sql`.

- [ ] **Step 3: Verify in Prisma Studio**

```bash
npx prisma studio
```

Expected: opens `localhost:5555` showing the existing `User`/
`RefreshToken` tables plus new, empty `MasterResume` and `Application`
tables. Close it (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add MasterResume and Application Prisma models"
```

---

### Task 2: Master resume API and client hook

**Files:**
- Create: `app/api/master-resume/route.ts`
- Create: `lib/hooks/useMasterResume.ts`

**Interfaces:**
- Consumes: `prisma` (`lib/prisma.ts`), `requireAuth`/`UnauthorizedError`
  (`lib/auth/requireAuth.ts`), `authFetch` (`lib/auth/authFetch.ts`) —
  all existing.
- Produces: `GET`/`POST /api/master-resume` — consumed by
  `useMasterResume`, and directly by `/api/optimize` in Task 4 (via
  `prisma.masterResume.findUnique`, not HTTP). `useMasterResume(enabled:
  boolean): { fileName: string | null; loaded: boolean; reload: () =>
  void }` from `lib/hooks/useMasterResume.ts` — used by
  `app/applications/new/page.tsx` (Task 5) and `MasterResumeControl`
  (Task 7).

- [ ] **Step 1: Write `app/api/master-resume/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const masterResume = await prisma.masterResume.findUnique({ where: { userId } });
  if (!masterResume) {
    return NextResponse.json({ error: "No master resume on file" }, { status: 404 });
  }

  return NextResponse.json({
    fileName: masterResume.fileName,
    updatedAt: masterResume.updatedAt,
  });
}

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
  const file = form.get("resume");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing resume file" }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".docx") && !lowerName.endsWith(".pdf")) {
    return NextResponse.json({ error: "Only .docx and .pdf resumes are supported" }, { status: 400 });
  }

  const fileData = Buffer.from(await file.arrayBuffer());

  const masterResume = await prisma.masterResume.upsert({
    where: { userId },
    create: { userId, fileName: file.name, mimeType: file.type, fileData },
    update: { fileName: file.name, mimeType: file.type, fileData },
  });

  return NextResponse.json({
    fileName: masterResume.fileName,
    updatedAt: masterResume.updatedAt,
  });
}
```

- [ ] **Step 2: Write `lib/hooks/useMasterResume.ts`**

```ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/authFetch";

interface UseMasterResumeResult {
  fileName: string | null;
  loaded: boolean;
  reload: () => void;
}

export function useMasterResume(enabled: boolean): UseMasterResumeResult {
  const [fileName, setFileName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    if (!enabled) return;
    authFetch("/api/master-resume")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setFileName(data.fileName);
        } else {
          setFileName(null);
        }
      })
      .catch(() => setFileName(null))
      .finally(() => setLoaded(true));
  }, [enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { fileName, loaded, reload };
}
```

- [ ] **Step 3: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 4: Verify the API with curl**

```bash
npm run dev &
sleep 3

curl -i http://localhost:3000/api/master-resume
```

Expected: `HTTP/1.1 401`, `{"error":"Unauthorized"}`.

```bash
SIGNUP=$(curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"master-resume-test@example.com","password":"correct-horse"}')
TOKEN=$(echo "$SIGNUP" | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

curl -i http://localhost:3000/api/master-resume -H "Authorization: Bearer $TOKEN"
```

Expected: `HTTP/1.1 404`, `{"error":"No master resume on file"}` (fresh
user, nothing uploaded yet).

```bash
curl -i -X POST http://localhost:3000/api/master-resume \
  -H "Authorization: Bearer $TOKEN" \
  -F "resume=@$RESUME_FIXTURE"
```

Expected: `HTTP/1.1 200` with `fileName` matching `$RESUME_FIXTURE`'s
basename and an `updatedAt` timestamp.

```bash
curl -i http://localhost:3000/api/master-resume -H "Authorization: Bearer $TOKEN"
```

Expected: `HTTP/1.1 200`, same `fileName` as above (now persisted).

(Leave the dev server running — later tasks reuse it.)

- [ ] **Step 5: Commit**

```bash
git add app/api/master-resume/route.ts lib/hooks/useMasterResume.ts
git commit -m "feat: add master resume upload/fetch API and client hook"
```

---

### Task 3: Applications list and detail API

**Files:**
- Create: `app/api/applications/route.ts`
- Create: `app/api/applications/[id]/route.ts`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`/`UnauthorizedError` — existing.
- Produces: `GET /api/applications` (list), `GET`/`DELETE
  /api/applications/:id` (detail/delete) — consumed by
  `app/page.tsx` (Task 7) and `app/applications/[id]/page.tsx` (Task 6).

- [ ] **Step 1: Write `app/api/applications/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const applications = await prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      roleTitle: true,
      atsScore: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ applications });
}
```

- [ ] **Step 2: Write `app/api/applications/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

async function loadOwnedApplication(id: string, userId: string) {
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application || application.userId !== userId) {
    return null;
  }
  return application;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const application = await loadOwnedApplication(id, userId);
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: application.id,
    companyName: application.companyName,
    roleTitle: application.roleTitle,
    jobDescription: application.jobDescription,
    resumeData: application.resumeData,
    atsScore: application.atsScore,
    matchedKeywords: application.matchedKeywords,
    missingKeywords: application.missingKeywords,
    summaryOfChanges: {
      headline: application.summaryHeadline,
      bullets: application.summaryBullets,
    },
    createdAt: application.createdAt,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const application = await loadOwnedApplication(id, userId);
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.application.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 3: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 4: Verify with curl (the parts that don't need a real `Application` row)**

```bash
curl -i http://localhost:3000/api/applications
```

Expected: `HTTP/1.1 401`.

```bash
SIGNUP=$(curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"applications-list-test@example.com","password":"correct-horse"}')
TOKEN=$(echo "$SIGNUP" | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

curl -i http://localhost:3000/api/applications -H "Authorization: Bearer $TOKEN"
```

Expected: `HTTP/1.1 200`, `{"applications":[]}` (fresh user, none created
yet).

```bash
curl -i http://localhost:3000/api/applications/does-not-exist -H "Authorization: Bearer $TOKEN"
curl -i -X DELETE http://localhost:3000/api/applications/does-not-exist -H "Authorization: Bearer $TOKEN"
```

Expected: both `HTTP/1.1 404`, `{"error":"Not found"}`.

The full read/delete-of-a-real-row path (and the cross-user 404 check)
is verified in Task 4, once `/api/optimize` can actually create
`Application` rows to test against.

- [ ] **Step 5: Commit**

```bash
git add app/api/applications/route.ts app/api/applications/[id]/route.ts
git commit -m "feat: add applications list, detail, and delete API"
```

---

### Task 4: Persist an `Application` from `/api/optimize`

**Files:**
- Modify: `app/api/optimize/route.ts`

**Interfaces:**
- Consumes: `prisma` (Task 1's models), everything `/api/optimize`
  already used (`parseDocx`, `extractPdfText`, `sectionsFrom*`,
  `getAiProvider`, `requireAuth`).
- Produces: `/api/optimize` now accepts `companyName`, `roleTitle`,
  `useMaster` ("true"/"false"), and either `resume` (a `File`, when
  `useMaster` is `"false"`) or `saveAsMaster` ("true"/"false", only
  meaningful alongside an override `resume`). On success it returns the
  existing fields plus `applicationId: string` — consumed by
  `app/applications/new/page.tsx` (Task 5).

- [ ] **Step 1: Rewrite `app/api/optimize/route.ts`**

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
    buffer = masterResume.fileData;
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
    await prisma.masterResume.upsert({
      where: { userId },
      create: { userId, fileName, mimeType, fileData: buffer },
      update: { fileName, mimeType, fileData: buffer },
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
  console.time("Optimizing resume with AI");
  try {
    result = await ai.optimizeResume({ sections, jobDescription });
  } catch (err) {
    console.error("AI optimization failed", err);
    return NextResponse.json({ error: "Resume optimization failed. Please try again." }, { status: 502 });
  } finally {
    console.timeEnd("Optimizing resume with AI");
  }
  console.timeEnd("Extracting structured resume data");

  const application = await prisma.application.create({
    data: {
      userId,
      companyName: companyName.trim(),
      roleTitle: roleTitle.trim(),
      jobDescription,
      resumeData: result.resumeData,
      atsScore: result.atsScore,
      matchedKeywords: result.matchedKeywords,
      missingKeywords: result.missingKeywords,
      summaryHeadline: result.summaryOfChanges.headline,
      summaryBullets: result.summaryOfChanges.bullets,
    },
  });

  return NextResponse.json({
    applicationId: application.id,
    atsScore: result.atsScore,
    matchedKeywords: result.matchedKeywords,
    missingKeywords: result.missingKeywords,
    summaryOfChanges: result.summaryOfChanges,
    resumeData: result.resumeData,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Verify validation errors with curl (no file needed)**

```bash
SIGNUP=$(curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"optimize-test@example.com","password":"correct-horse"}')
TOKEN=$(echo "$SIGNUP" | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

curl -i -X POST http://localhost:3000/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -F "jobDescription=We need a backend engineer" \
  -F "useMaster=false"
```

Expected: `HTTP/1.1 400`, `{"error":"Missing company name"}` (no
`companyName` field sent).

```bash
curl -i -X POST http://localhost:3000/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -F "companyName=Acme Corp" \
  -F "roleTitle=Backend Engineer" \
  -F "jobDescription=We need a backend engineer" \
  -F "useMaster=true"
```

Expected: `HTTP/1.1 400`, `{"error":"No master resume on file"}` (this
fresh user has never uploaded one).

- [ ] **Step 4: Verify the full create → read → delete path with curl (needs `$RESUME_FIXTURE`)**

```bash
RESPONSE=$(curl -s -X POST http://localhost:3000/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -F "companyName=Acme Corp" \
  -F "roleTitle=Senior Backend Engineer" \
  -F "jobDescription=We are looking for a backend engineer with Node.js and Postgres experience." \
  -F "useMaster=false" \
  -F "saveAsMaster=true" \
  -F "resume=@$RESUME_FIXTURE")
echo "$RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).applicationId"
APP_ID=$(echo "$RESPONSE" | node -pe "JSON.parse(require('fs').readFileSync(0)).applicationId")
```

Expected: prints a cuid-looking string (e.g. `clxyz...`), no error field
in `$RESPONSE`.

```bash
curl -i http://localhost:3000/api/applications -H "Authorization: Bearer $TOKEN"
```

Expected: `HTTP/1.1 200`, `applications` array with exactly one entry:
`companyName: "Acme Corp"`, `roleTitle: "Senior Backend Engineer"`.

```bash
curl -i http://localhost:3000/api/applications/$APP_ID -H "Authorization: Bearer $TOKEN"
```

Expected: `HTTP/1.1 200`, full record including a populated
`resumeData` object and `jobDescription`.

```bash
curl -i http://localhost:3000/api/master-resume -H "Authorization: Bearer $TOKEN"
```

Expected: `HTTP/1.1 200` — `saveAsMaster=true` above means this user now
has a master resume too, with `fileName` matching `$RESUME_FIXTURE`.

```bash
curl -i -X DELETE http://localhost:3000/api/applications/$APP_ID -H "Authorization: Bearer $TOKEN"
curl -i http://localhost:3000/api/applications/$APP_ID -H "Authorization: Bearer $TOKEN"
```

Expected: `DELETE` returns `HTTP/1.1 204`; the following `GET` returns
`HTTP/1.1 404`.

- [ ] **Step 5: Verify cross-user 404 (ownership check)**

```bash
SIGNUP2=$(curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"optimize-test-2@example.com","password":"correct-horse"}')
TOKEN2=$(echo "$SIGNUP2" | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

RESPONSE2=$(curl -s -X POST http://localhost:3000/api/optimize \
  -H "Authorization: Bearer $TOKEN" \
  -F "companyName=Second Co" \
  -F "roleTitle=Engineer" \
  -F "jobDescription=Another job description for a second test application." \
  -F "useMaster=true")
APP_ID_2=$(echo "$RESPONSE2" | node -pe "JSON.parse(require('fs').readFileSync(0)).applicationId")

curl -i http://localhost:3000/api/applications/$APP_ID_2 -H "Authorization: Bearer $TOKEN2"
```

Expected: `HTTP/1.1 404` — `$TOKEN2`'s user doesn't own `$APP_ID_2`
(created by `$TOKEN`'s user, reusing the master resume saved in Step 4).

- [ ] **Step 6: Commit**

```bash
git add app/api/optimize/route.ts
git commit -m "feat: persist an Application record on successful optimize"
```

---

### Task 5: New-application flow — step components and page

**Files:**
- Create: `components/ApplicationDetailsStep.tsx`
- Create: `components/ResumeSourceStep.tsx`
- Create: `app/applications/new/page.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `authFetch` (existing), `useMasterResume` (Task
  2), `JobDescriptionStep`, `LoadingView`, `ThemeToggle` (existing,
  unmodified).
- Produces: `ApplicationDetailsStep` (props: `companyName`, `roleTitle`,
  `onCompanyNameChange`, `onRoleTitleChange`, `onNext`). `ResumeSource`
  type and `ResumeSourceStep` (props: `masterResumeFileName: string |
  null`, `onBack`, `onNext: (source: ResumeSource) => void`) — both used
  only by `app/applications/new/page.tsx` in this task. The `/applications/new`
  route itself, which POSTs to `/api/optimize` and redirects to
  `/applications/:id` on success.

- [ ] **Step 1: Write `components/ApplicationDetailsStep.tsx`**

```tsx
"use client";

import { IconArrowRight } from "@tabler/icons-react";

interface ApplicationDetailsStepProps {
  companyName: string;
  roleTitle: string;
  onCompanyNameChange: (value: string) => void;
  onRoleTitleChange: (value: string) => void;
  onNext: () => void;
}

export function ApplicationDetailsStep({
  companyName,
  roleTitle,
  onCompanyNameChange,
  onRoleTitleChange,
  onNext,
}: ApplicationDetailsStepProps) {
  const canProceed = companyName.trim().length > 0 && roleTitle.trim().length > 0;

  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Application details
      </p>
      <div className="space-y-3">
        <div>
          <label htmlFor="companyName" className="text-sm text-gray-700 dark:text-gray-300">
            Company
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Acme Corp"
            className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label htmlFor="roleTitle" className="text-sm text-gray-700 dark:text-gray-300">
            Role title
          </label>
          <input
            id="roleTitle"
            type="text"
            value={roleTitle}
            onChange={(e) => onRoleTitleChange(e.target.value)}
            placeholder="Senior Backend Engineer"
            className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canProceed}
          onClick={onNext}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          Next <IconArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `components/ResumeSourceStep.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileUpload, IconFileTypePdf, IconCheck, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";

export type ResumeSource =
  | { useMaster: true }
  | { useMaster: false; file: File; saveAsMaster: boolean };

interface ResumeSourceStepProps {
  masterResumeFileName: string | null;
  onBack: () => void;
  onNext: (source: ResumeSource) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeSourceStep({ masterResumeFileName, onBack, onNext }: ResumeSourceStepProps) {
  const hasMaster = masterResumeFileName !== null;
  const [useUpload, setUseUpload] = useState(!hasMaster);
  const [file, setFile] = useState<File | null>(null);
  const [saveAsMaster, setSaveAsMaster] = useState(true);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
  });

  const showUpload = useUpload || !hasMaster;
  const canProceed = hasMaster && !useUpload ? true : file !== null;

  function handleNext() {
    if (hasMaster && !useUpload) {
      onNext({ useMaster: true });
      return;
    }
    if (!file) return;
    onNext({ useMaster: false, file, saveAsMaster: hasMaster ? false : saveAsMaster });
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Resume</p>

      {hasMaster && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="radio" name="resumeSource" checked={!useUpload} onChange={() => setUseUpload(false)} />
            Use my master resume ({masterResumeFileName})
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="radio" name="resumeSource" checked={useUpload} onChange={() => setUseUpload(true)} />
            Upload a different resume for this application
          </label>
        </div>
      )}

      {showUpload && (
        <div className="space-y-3">
          {file ? (
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3">
              <IconFileTypePdf className="text-blue-600 shrink-0" size={24} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate text-gray-900 dark:text-white">{file.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(file.size)} · ready to optimize</p>
              </div>
              <IconCheck className="text-green-500 shrink-0" size={20} />
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-10 text-center bg-gray-50 dark:bg-gray-800 cursor-pointer transition-colors ${
                isDragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-gray-300 dark:border-gray-700 hover:border-blue-500"
              }`}
            >
              <input {...getInputProps()} />
              <IconFileUpload className="mx-auto text-gray-400 dark:text-gray-500 mb-3" size={28} />
              <p className="font-medium text-sm text-gray-700 dark:text-gray-300">Drop your resume here</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF or DOCX · up to 5MB</p>
              <div className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1 text-xs text-gray-600 dark:text-gray-400 mt-3">
                Browse files
              </div>
            </div>
          )}

          {!hasMaster && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={saveAsMaster} onChange={(e) => setSaveAsMaster(e.target.checked)} />
              Save as my master resume
            </label>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
        >
          <IconArrowLeft size={16} /> Back
        </button>
        <button
          type="button"
          disabled={!canProceed}
          onClick={handleNext}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors min-h-[44px]"
        >
          Next <IconArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `app/applications/new/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@tabler/icons-react";
import { ApplicationDetailsStep } from "@/components/ApplicationDetailsStep";
import { ResumeSourceStep, type ResumeSource } from "@/components/ResumeSourceStep";
import { JobDescriptionStep } from "@/components/JobDescriptionStep";
import { LoadingView } from "@/components/LoadingView";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { useMasterResume } from "@/lib/hooks/useMasterResume";
import { ThemeToggle } from "@/components/ThemeToggle";

type Step = "details" | "resume" | "jobDescription";

const STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "resume", label: "Resume" },
  { key: "jobDescription", label: "Job description" },
];

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.key === step);
}

function Stepper({ currentStep }: { currentStep: Step }) {
  const current = stepIndex(currentStep);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-gray-200 dark:bg-gray-700" />}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  done
                    ? "bg-green-500 text-white"
                    : active
                    ? "bg-blue-600 text-white"
                    : "border border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-600"
                }`}
              >
                {done ? <IconCheck size={10} /> : <span className="text-[10px] font-medium">{i + 1}</span>}
              </div>
              <span
                className={`hidden md:inline text-sm whitespace-nowrap ${
                  active ? "text-blue-600 font-medium" : "text-gray-400 dark:text-gray-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface OptimizeResponse {
  applicationId: string;
}

export default function NewApplicationPage() {
  const router = useRouter();
  const { accessToken, ready } = useAuth();
  const { fileName: masterResumeFileName, loaded: masterResumeLoaded } = useMasterResume(!!accessToken);
  const [step, setStep] = useState<Step>("details");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [resumeSource, setResumeSource] = useState<ResumeSource | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !accessToken) {
      router.push("/login");
    }
  }, [ready, accessToken, router]);

  async function handleSubmit() {
    if (!resumeSource) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("companyName", companyName);
      formData.append("roleTitle", roleTitle);
      formData.append("jobDescription", jobDescription);
      formData.append("useMaster", String(resumeSource.useMaster));
      if (!resumeSource.useMaster) {
        formData.append("resume", resumeSource.file);
        formData.append("saveAsMaster", String(resumeSource.saveAsMaster));
      }

      const res = await authFetch("/api/optimize", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Optimization failed");
      }
      const data: OptimizeResponse = await res.json();
      router.push(`/applications/${data.applicationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (!ready || !accessToken || !masterResumeLoaded) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="font-medium text-gray-900 dark:text-white">
            Resume<span className="text-blue-600">Tailor</span>
          </span>
          <div className="flex items-center gap-4">
            <Stepper currentStep={step} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {error && (
          <p className="mb-6 rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {loading && <LoadingView />}

        {!loading && step === "details" && (
          <ApplicationDetailsStep
            companyName={companyName}
            roleTitle={roleTitle}
            onCompanyNameChange={setCompanyName}
            onRoleTitleChange={setRoleTitle}
            onNext={() => setStep("resume")}
          />
        )}
        {!loading && step === "resume" && (
          <ResumeSourceStep
            masterResumeFileName={masterResumeFileName}
            onBack={() => setStep("details")}
            onNext={(source) => {
              setResumeSource(source);
              setStep("jobDescription");
            }}
          />
        )}
        {!loading && step === "jobDescription" && (
          <JobDescriptionStep
            jobDescription={jobDescription}
            onChange={setJobDescription}
            onBack={() => setStep("resume")}
            onSubmit={handleSubmit}
            loading={loading}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 5: Verify in the browser**

With `npm run dev` running (already backgrounded from Task 2):
1. Log in (or sign up) at `/login`.
2. Navigate to `http://localhost:3000/applications/new` directly (the
   dashboard button isn't wired up until Task 7).
3. Fill in company/role, click Next.
4. If this account has no master resume yet: confirm upload is forced
   and "Save as my master resume" is checked by default. If it does
   (e.g. the curl tests in Task 4 created one for this email): confirm
   the "Use my master resume" option is pre-selected and shows the right
   filename, and that choosing "Upload a different resume" reveals the
   dropzone with no checkbox.
5. Paste a job description, click Optimize.
6. Confirm the loading view appears, then the browser navigates to
   `/applications/<id>` (a 404-looking blank page is expected here — the
   page doesn't exist until Task 6).

- [ ] **Step 6: Commit**

```bash
git add components/ApplicationDetailsStep.tsx components/ResumeSourceStep.tsx app/applications/new/page.tsx
git commit -m "feat: add new-application flow with company/role and resume-source steps"
```

---

### Task 6: Application detail page

**Files:**
- Create: `app/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `authFetch`, `ResultView` (existing,
  unmodified), `ResumeData` type — all existing. `GET`/`DELETE
  /api/applications/:id` (Task 3).

- [ ] **Step 1: Write `app/applications/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ResultView } from "@/components/ResultView";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ResumeData } from "@/types/resume.types";

interface ApplicationDetail {
  id: string;
  companyName: string;
  roleTitle: string;
  jobDescription: string;
  resumeData: ResumeData;
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summaryOfChanges: { headline: string; bullets: string[] };
}

export default function ApplicationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { accessToken, ready } = useAuth();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

            <ResultView
              atsScore={application.atsScore}
              matchedKeywords={application.matchedKeywords}
              missingKeywords={application.missingKeywords}
              summaryOfChanges={application.summaryOfChanges}
              resumeData={application.resumeData}
              onRestart={() => router.push("/")}
            />
          </>
        )}
      </main>
    </div>
  );
}
```

(`ResultView`'s "Start over" button calls `onRestart` — here that's
wired to navigate back to the dashboard, since there's no local upload
flow on this page to reset.)

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Verify in the browser**

With `npm run dev` running, repeat the flow from Task 5's Step 5
(`/applications/new` → fill in details → optimize). Confirm:
1. The browser lands on `/applications/<id>` and shows company/role,
   the ATS score, keywords, "What changed", template picker, and
   "Download PDF" (all from `ResultView`, unchanged).
2. "Download PDF" produces a real PDF.
3. Clicking "Start over" navigates to `/` (still the old 3-step upload
   flow until Task 7 — that's expected here).
4. Reload the `/applications/<id>` URL directly — confirm the same data
   loads again from the API (not just client-side state).
5. Click "Delete this application" — confirm it navigates to `/` and a
   direct reload of the old `/applications/<id>` URL now shows the
   "Application not found" error state.

- [ ] **Step 4: Commit**

```bash
git add app/applications/[id]/page.tsx
git commit -m "feat: add application detail page with download and delete"
```

---

### Task 7: Dashboard, master-resume control, and cleanup

**Files:**
- Modify: `app/page.tsx` (replaces the 3-step upload flow with the
  applications dashboard)
- Create: `components/MasterResumeControl.tsx`
- Delete: `components/UploadStep.tsx` (only ever imported by the old
  `app/page.tsx`; once this task replaces that file, nothing references
  it)

**Interfaces:**
- Consumes: `useAuth()`, `authFetch`, `useMasterResume` (Task 2).
- Produces: `MasterResumeControl` (no props) — a self-contained widget
  used only on the dashboard.

- [ ] **Step 1: Write `components/MasterResumeControl.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { authFetch } from "@/lib/auth/authFetch";
import { useMasterResume } from "@/lib/hooks/useMasterResume";

export function MasterResumeControl() {
  const { fileName, loaded, reload } = useMasterResume(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("resume", file);
        const res = await authFetch("/api/master-resume", { method: "POST", body: formData });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(typeof body.error === "string" ? body.error : "Upload failed");
        }
        reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [reload]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    maxFiles: 1,
    noDrag: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
  });

  if (!loaded) return null;

  return (
    <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <span className="text-gray-600 dark:text-gray-300 truncate">
        Master resume: {fileName ?? "none uploaded yet"}
      </span>
      <div {...getRootProps()} className="shrink-0 ml-3">
        <input {...getInputProps()} />
        <button type="button" disabled={uploading} className="text-blue-600 hover:text-blue-700 disabled:opacity-50">
          {uploading ? "Uploading..." : fileName ? "Replace" : "Upload"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 ml-3">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx` with the dashboard**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MasterResumeControl } from "@/components/MasterResumeControl";

interface ApplicationSummary {
  id: string;
  companyName: string;
  roleTitle: string;
  atsScore: number;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();
  const { accessToken, ready, logout } = useAuth();
  const [applications, setApplications] = useState<ApplicationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !accessToken) {
      router.push("/login");
    }
  }, [ready, accessToken, router]);

  useEffect(() => {
    if (!accessToken) return;
    authFetch("/api/applications")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load applications");
        const data = await res.json();
        setApplications(data.applications);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load applications"));
  }, [accessToken]);

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
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => logout().then(() => router.push("/login"))}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Log out
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <MasterResumeControl />

        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-widest text-gray-400 dark:text-gray-500">Applications</p>
          <button
            type="button"
            onClick={() => router.push("/applications/new")}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 transition-colors min-h-[44px]"
          >
            <IconPlus size={16} /> New application
          </button>
        </div>

        {applications === null && <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>}

        {applications !== null && applications.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">No applications yet. Start by creating a new one.</p>
        )}

        {applications !== null && applications.length > 0 && (
          <div className="space-y-2">
            {applications.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => router.push(`/applications/${app.id}`)}
                className="w-full text-left bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between hover:border-blue-500 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                    {app.roleTitle} · {app.companyName}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm font-medium text-green-600 shrink-0 ml-3">{app.atsScore}/100</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Delete the now-unused `UploadStep` component**

```bash
git rm components/UploadStep.tsx
```

- [ ] **Step 4: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors and no "unused import" or
"module not found" errors referencing `UploadStep`.

- [ ] **Step 5: Verify in the browser**

With `npm run dev` running:
1. Open `http://localhost:3000/` while logged in. Confirm it shows the
   dashboard: master resume control, "New application" button, and the
   applications created in earlier tasks' verification steps (if any
   still exist for this login — otherwise the empty state).
2. Click "Replace"/"Upload" on the master resume control, pick a file,
   confirm the label updates to the new filename without a page reload.
3. Click "New application", complete the flow, confirm it lands on the
   new application's detail page and that the dashboard (navigate back
   via the header logo or browser back button) now lists it.
4. Delete an application from its detail page, confirm it disappears
   from the dashboard list.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/MasterResumeControl.tsx components/UploadStep.tsx
git commit -m "feat: turn the home page into an applications dashboard"
```

---

### Task 8: Documentation

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update the "Request flow" section**

In `CLAUDE.md`, replace the existing numbered request-flow list (the one
starting "User uploads a `.docx` or `.pdf` resume...") with:

```markdown
1. Logging in lands on the applications dashboard (`app/page.tsx`),
   listing the user's saved applications and showing their master resume
   status (`components/MasterResumeControl.tsx`).
2. "New application" starts a 3-step flow at `app/applications/new/page.tsx`:
   company/role (`components/ApplicationDetailsStep.tsx`), resume source
   — master resume reuse or a one-off override upload
   (`components/ResumeSourceStep.tsx`) — then job description
   (`components/JobDescriptionStep.tsx`, unchanged).
3. The browser POSTs `multipart/form-data` to `POST /api/optimize`
   (`app/api/optimize/route.ts`): `companyName`, `roleTitle`,
   `jobDescription`, `useMaster`, and either `resume` (override upload)
   or nothing (server loads the stored `MasterResume`).
4. The route parses the resume into `ResumeSection[]`, calls
   `getAiProvider().optimizeResume(...)`, and on success persists an
   `Application` row (company/role/job description/`resumeData`/score/
   keywords/summary — no file) before returning the result plus its new
   `applicationId`.
5. The browser redirects to `/applications/:id`
   (`app/applications/[id]/page.tsx`), which fetches the saved record via
   `GET /api/applications/:id` and renders it with the existing
   `ResultView` component.
6. Downloads are unchanged: `ResultView` posts `resumeData` +
   `templateId` to `POST /api/resume/render`, which renders a PDF from
   scratch every time — nothing is ever stored as rendered bytes.
```

- [ ] **Step 2: Add persistence models to the "Authentication" section's neighbor**

Immediately after the existing "### Authentication" subsection in
`CLAUDE.md`, add:

```markdown
### Job applications and the master resume

- `prisma/schema.prisma` — `MasterResume` (one per user, stores the
  original uploaded file's bytes so it can be re-parsed for a future
  application) and `Application` (company, role, job description, and
  the AI's structured output — no file) models.
- `app/api/master-resume/route.ts` — `GET` (metadata only) / `POST`
  (upload or replace) the user's master resume.
- `app/api/applications/route.ts`, `app/api/applications/[id]/route.ts`
  — list / detail / delete a user's saved applications.
- `lib/hooks/useMasterResume.ts` — shared client hook used by both the
  dashboard's `MasterResumeControl` and the new-application flow's
  `ResumeSourceStep` to know whether a master resume already exists.
- Replacing the master resume never touches past `Application` rows —
  each one already has its own frozen `resumeData` snapshot from when it
  was created.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the job-applications feature and new architecture"
```

---

### Task 9: Full manual walkthrough

**Files:** none — verification only, exercising Tasks 1–8 together.

- [ ] **Step 1: Fresh user, empty state, first master resume**

1. `npm run dev` (if not already running).
2. Sign up with a brand-new email at `/signup`.
3. Confirm landing on `/` showing the dashboard's empty state ("No
   applications yet") and "Master resume: none uploaded yet".

- [ ] **Step 2: First application forces an upload and saves a master resume**

1. Click "New application". Fill in company/role.
2. On the resume step, confirm upload is forced (no master resume yet)
   and "Save as my master resume" is checked by default. Upload
   `$RESUME_FIXTURE`.
3. Paste a job description, click Optimize.
4. Confirm redirect to the new application's detail page showing score,
   keywords, and a working "Download PDF".
5. Go back to `/` — confirm the dashboard now shows "Master resume:
   `<fileName>`" and lists the new application.

- [ ] **Step 3: Second application reuses the master resume by default**

1. Click "New application" again. Fill in a different company/role.
2. Confirm the resume step now defaults to "Use my master resume
   (`<fileName>`)" and skips requiring a new upload.
3. Complete the flow. Confirm the dashboard now lists two applications.

- [ ] **Step 4: Third application overrides without touching the master resume**

1. Click "New application". On the resume step, choose "Upload a
   different resume for this application" and upload a different file
   (or the same `$RESUME_FIXTURE` again if that's all you have).
2. Confirm there is **no** "Save as my master resume" checkbox in this
   path.
3. Complete the flow. Go to `/` — confirm "Master resume: `<fileName>`"
   still shows the **original** file from Step 2, unchanged.

- [ ] **Step 5: Replacing the master resume doesn't affect past applications**

1. On the dashboard, click "Replace" on the master resume control and
   upload a different file.
2. Open one of the applications created in Step 2 or 3 — confirm its
   `resumeData`/score/keywords are exactly as they were (unaffected by
   the replacement).

- [ ] **Step 6: Delete and ownership**

1. Delete one application from its detail page — confirm it disappears
   from the dashboard.
2. Confirm unauthenticated access is still rejected:
   ```bash
   curl -i http://localhost:3000/api/applications
   curl -i http://localhost:3000/api/master-resume
   ```
   Expected: both `HTTP/1.1 401`.

- [ ] **Step 7: No commit for this task** — it's verification only. If
  any step fails, go back to the relevant task, fix it, and re-run this
  walkthrough from the top.
