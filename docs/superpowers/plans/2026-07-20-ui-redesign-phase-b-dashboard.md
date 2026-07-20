# UI Redesign Phase B: Shared App Header + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared `AppHeader` component, extend `GET /api/applications` with a per-row optimized flag, and redesign the dashboard (stats row, master-resume banner, application list, empty state) using the Phase A design tokens.

**Architecture:** `AppHeader` is a new presentational component (wordmark + a `rightSlot` prop for screen-specific content) that `app/page.tsx` adopts in place of its inline header. `GET /api/applications` adds `resumeData: true` to its Prisma select, derives `optimized: resumeData !== null` per row server-side, and drops the raw `resumeData` field before returning JSON. `components/MasterResumeControl.tsx` keeps its existing `useMasterResume`/`useDropzone` logic untouched and only gets new markup/classNames. `app/page.tsx` composes all three plus a client-computed stats row (no new endpoint).

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, Prisma 6.19.3, `@tabler/icons-react` (already a dependency — `IconPlus` already used elsewhere in this codebase; `IconChevronRight` and `IconFileText` are standard Tabler icon names, add them to existing imports).

## Global Constraints

- No new dependencies.
- Tailwind utility classes only — no inline `style={}` (matches the Phase A convention; use Tailwind arbitrary-value classes like `grid-cols-[repeat(auto-fit,minmax(150px,1fr))]` instead of inline styles for anything CSS-Grid-shaped).
- Reuse Phase A's tokens (`bg-bg`, `bg-surface`, `bg-surface-alt`, `text-text-primary`, `text-text-secondary`, `border-border-hairline`, `text-accent`, `border-accent`, `bg-accent-surface`, `text-accent-surface-text`, `bg-chip-neutral-bg`, `text-chip-neutral-text`, `rounded-card`) — no new CSS tokens needed for this phase.
- `components/MasterResumeControl.tsx`: preserve `useMasterResume`, `useDropzone`, `onDrop`, and all state (`uploading`, `error`) exactly as they are today — this task is a markup/className restyle only, not a logic change.
- `app/page.tsx`: preserve the existing auth-redirect `useEffect`, the fetch-on-mount `useEffect`, and `authFetch("/api/applications")` call exactly — only the JSX changes.
- `GET /api/applications` must never include the raw `resumeData` field in its JSON response — only the derived `optimized: boolean`.
- `AppHeader` ships with only a `rightSlot?: React.ReactNode` prop in this phase. Do not add a `stepperItems` prop or any stepper-rendering JSX yet — Phase C (not yet planned) is the first phase that can actually exercise and verify a stepper, and shipping unexercised rendering logic now would be both YAGNI and untestable by this plan's own verification steps. Phase C will extend `AppHeaderProps` itself when it needs to.
- No debug "Preview: …" links anywhere (explicit exclusion carried over from the Phase A/handoff conventions).

---

### Task 1: Add `optimized` field to `GET /api/applications`

**Files:**
- Modify: `app/api/applications/route.ts`

**Interfaces:**
- Consumes: `prisma.application.findMany` (existing Prisma client, `@/lib/prisma`), `requireAuth`/`UnauthorizedError` (existing, `@/lib/auth/requireAuth`).
- Produces: the `GET /api/applications` JSON response now has `applications: Array<{ id: string; companyName: string; roleTitle: string; atsScore: number; createdAt: string; optimized: boolean }>` — consumed by Task 4's `app/page.tsx`.

- [ ] **Step 1: Replace the contents of `app/api/applications/route.ts`**

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

  const rows = await prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      roleTitle: true,
      atsScore: true,
      createdAt: true,
      resumeData: true,
    },
  });

  const applications = rows.map(({ resumeData, ...rest }) => ({
    ...rest,
    optimized: resumeData !== null,
  }));

  return NextResponse.json({ applications });
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Verify with curl + a direct Prisma insert (bypasses the AI provider entirely — this task only touches the read path, not scoring/optimizing)**

```bash
npm run dev > /tmp/phase-b-dev.log 2>&1 &
disown
sleep 5

SIGNUP=$(curl -s -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"dashboard-task1@example.com","password":"correct-horse"}')
TOKEN=$(echo "$SIGNUP" | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email: 'dashboard-task1@example.com' } });
  const scored = await prisma.application.create({
    data: {
      userId: user.id, companyName: 'Scored Co', roleTitle: 'Engineer', jobDescription: 'jd',
      originalSections: [], originalAtsScore: 70, originalMatchedKeywords: [], originalMissingKeywords: [],
      suggestionsHeadline: 'h', suggestionsBullets: [],
      atsScore: 70, matchedKeywords: [], missingKeywords: [],
    },
  });
  const optimized = await prisma.application.create({
    data: {
      userId: user.id, companyName: 'Optimized Co', roleTitle: 'Engineer', jobDescription: 'jd',
      originalSections: [], originalAtsScore: 70, originalMatchedKeywords: [], originalMissingKeywords: [],
      suggestionsHeadline: 'h', suggestionsBullets: [],
      atsScore: 85, matchedKeywords: [], missingKeywords: [],
      resumeData: { fake: true }, summaryHeadline: 's', summaryBullets: [],
    },
  });
  console.log(JSON.stringify({ scoredId: scored.id, optimizedId: optimized.id }));
  await prisma.\$disconnect();
})();
"

curl -s http://localhost:3000/api/applications -H "Authorization: Bearer $TOKEN" | node -pe "JSON.stringify(JSON.parse(require('fs').readFileSync(0)), null, 2)"
```

Expected: the JSON response's `applications` array has two entries — "Optimized Co" with `"optimized": true` and "Scored Co" with `"optimized": false` — and neither entry has a `resumeData` key anywhere in the output.

Clean up the test rows:

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const user = await prisma.user.findUnique({ where: { email: 'dashboard-task1@example.com' } });
  await prisma.application.deleteMany({ where: { userId: user.id } });
  await prisma.\$disconnect();
})();
"
```

- [ ] **Step 4: Commit**

```bash
git add app/api/applications/route.ts
git commit -m "feat: add optimized flag to GET /api/applications"
```

---

### Task 2: Create shared `AppHeader` component

**Files:**
- Create: `components/AppHeader.tsx`

**Interfaces:**
- Consumes: nothing new (`next/link`, standard React types).
- Produces: `export function AppHeader({ rightSlot }: { rightSlot?: React.ReactNode }): JSX.Element` — consumed by Task 4's `app/page.tsx`.

- [ ] **Step 1: Create `components/AppHeader.tsx`**

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface AppHeaderProps {
  rightSlot?: ReactNode;
}

export function AppHeader({ rightSlot }: AppHeaderProps) {
  return (
    <div className="flex items-center gap-[17px] px-[clamp(24px,6vw,64px)] py-2">
      <Link href="/" className="text-[18px] font-medium tracking-[-0.015em] mr-auto">
        Resume<span className="text-accent">Tailor</span>
      </Link>
      {rightSlot}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors (the component isn't imported anywhere yet, so this only confirms the file itself is valid TypeScript/JSX).

- [ ] **Step 3: Commit**

```bash
git add components/AppHeader.tsx
git commit -m "feat: add shared AppHeader component"
```

---

### Task 3: Restyle `MasterResumeControl`

**Files:**
- Modify: `components/MasterResumeControl.tsx`

**Interfaces:**
- Consumes: `useMasterResume` (existing, `@/lib/hooks/useMasterResume`), `authFetch` (existing, `@/lib/auth/authFetch`), `useDropzone` (existing dependency, `react-dropzone`), `IconFileText` (new import from the already-installed `@tabler/icons-react`).
- Produces: `export function MasterResumeControl(): JSX.Element | null` — same export signature as today, consumed by Task 4's `app/page.tsx` (no prop changes).

- [ ] **Step 1: Replace the contents of `components/MasterResumeControl.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileText } from "@tabler/icons-react";
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

  if (fileName) {
    return (
      <div className="flex items-center justify-between gap-3 bg-surface border border-accent-surface rounded-lg px-4 py-3 flex-wrap">
        <div className="flex items-center gap-[11px] min-w-0">
          <IconFileText size={17} className="text-accent shrink-0" />
          <div className="min-w-0">
            <div className="text-[10.5px] tracking-wide text-accent uppercase">Master resume</div>
            <div className="text-[13.5px] text-text-primary truncate">{fileName}</div>
          </div>
        </div>
        <div {...getRootProps()} className="shrink-0">
          <input {...getInputProps()} />
          <button
            type="button"
            disabled={uploading}
            className="border-none bg-transparent text-accent text-[13px] cursor-pointer disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Replace"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400 w-full">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-surface border border-border-hairline rounded-lg px-4 py-3 flex-wrap">
      <div className="text-[13.5px] text-text-secondary">
        No master resume yet — upload one so new applications can reuse it.
      </div>
      <div {...getRootProps()} className="shrink-0">
        <input {...getInputProps()} />
        <button
          type="button"
          disabled={uploading}
          className="border border-accent bg-transparent text-accent px-[14px] py-[7px] rounded-lg text-[13px] font-medium cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {uploading ? "Uploading..." : "Upload resume"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 w-full">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

1. Log in (or sign up) at `http://localhost:3000/login`, land on the dashboard.
2. **Verify (no master resume):** a `bg-surface`/hairline-border banner reads "No master resume yet — upload one so new applications can reuse it." with an outlined "Upload resume" button.
3. Click "Upload resume", pick a `.docx` or `.pdf` file.
4. **Verify:** banner switches to the accent-bordered variant with a document icon, "MASTER RESUME" label in accent, the filename, and a "Replace" text link on the right.
5. Click "Replace", pick a different file.
6. **Verify:** filename updates, "Uploading..." shows briefly during the request.
7. Toggle dark/light — confirm both banner states render sensibly in both themes.

- [ ] **Step 3: Commit**

```bash
git add components/MasterResumeControl.tsx
git commit -m "feat: restyle MasterResumeControl banner with redesign tokens"
```

---

### Task 4: Redesign the dashboard (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `AppHeader` from `@/components/AppHeader` (Task 2), `MasterResumeControl` from `@/components/MasterResumeControl` (Task 3, unchanged export), `GET /api/applications` response shape including `optimized: boolean` (Task 1), `ThemeToggle` from `@/components/ThemeToggle` (unchanged), `useAuth` from `@/lib/auth/AuthContext` (unchanged), `authFetch` from `@/lib/auth/authFetch` (unchanged).
- Produces: no new exports — this is the `/` route page component.

- [ ] **Step 1: Replace the contents of `app/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconChevronRight, IconFileText } from "@tabler/icons-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MasterResumeControl } from "@/components/MasterResumeControl";
import { AppHeader } from "@/components/AppHeader";

interface ApplicationSummary {
  id: string;
  companyName: string;
  roleTitle: string;
  atsScore: number;
  createdAt: string;
  optimized: boolean;
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

  const apps = applications ?? [];
  const total = apps.length;
  const avgScore = total > 0 ? Math.round(apps.reduce((sum, a) => sum + a.atsScore, 0) / total) : 0;
  const optimizedCount = apps.filter((a) => a.optimized).length;

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <AppHeader
        rightSlot={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => logout().then(() => router.push("/login"))}
              className="border-none bg-transparent text-text-secondary text-[13.5px] cursor-pointer"
            >
              Log out
            </button>
            <ThemeToggle />
          </div>
        }
      />

      <main className="max-w-[760px] px-[clamp(24px,6vw,64px)] pt-7 pb-[72px]">
        <div className="flex items-baseline justify-between flex-wrap gap-[14px] mb-6">
          <div>
            <div className="text-[26px] font-medium tracking-[-0.015em]">Your applications</div>
            <div className="text-[13.5px] text-text-secondary mt-[3px]">
              Track ATS alignment across every role you apply to.
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/applications/new")}
            className="flex items-center gap-[7px] px-4 py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium cursor-pointer whitespace-nowrap"
          >
            <IconPlus size={14} /> New application
          </button>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300 mb-6">
            {error}
          </p>
        )}

        <div className="mb-6">
          <MasterResumeControl />
        </div>

        {applications === null && <p className="text-sm text-text-secondary">Loading...</p>}

        {applications !== null && total > 0 && (
          <div className="grid gap-[11px] mb-6 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            <div className="bg-surface rounded-lg px-4 py-[14px]">
              <div className="text-[10.5px] tracking-wide text-text-secondary uppercase">Applications</div>
              <div className="text-2xl font-medium mt-1">{total}</div>
            </div>
            <div className="bg-surface rounded-lg px-4 py-[14px]">
              <div className="text-[10.5px] tracking-wide text-text-secondary uppercase">Average score</div>
              <div className="text-2xl font-medium mt-1">
                {avgScore}
                <span className="text-[13px] text-text-secondary">/100</span>
              </div>
            </div>
            <div className="bg-surface rounded-lg px-4 py-[14px]">
              <div className="text-[10.5px] tracking-wide text-text-secondary uppercase">Optimized</div>
              <div className="text-2xl font-medium mt-1">
                {optimizedCount}
                <span className="text-[13px] text-text-secondary"> / {total}</span>
              </div>
            </div>
          </div>
        )}

        {applications !== null && total > 0 && (
          <div className="flex flex-col gap-[9px]">
            {apps.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => router.push(`/applications/${app.id}`)}
                className="w-full text-left bg-surface rounded-lg px-[18px] py-[15px] flex items-center justify-between gap-4 flex-wrap cursor-pointer"
              >
                <div className="flex flex-col gap-[5px] min-w-0">
                  <div className="flex items-center gap-[9px] flex-wrap">
                    <span className="text-[15px] font-medium">{app.roleTitle}</span>
                    <span className="text-[13px] text-text-secondary">· {app.companyName}</span>
                    <span
                      className={`text-[10.5px] tracking-wide uppercase px-[10px] py-[3px] rounded-md ${
                        app.optimized ? "bg-accent-surface text-accent-surface-text" : "bg-chip-neutral-bg text-chip-neutral-text"
                      }`}
                    >
                      {app.optimized ? "Optimized" : "Scored"}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-text-secondary">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-[10px] shrink-0">
                  <div className="text-[18px] font-medium text-text-primary">
                    {app.atsScore}
                    <span className="text-xs text-text-secondary">/100</span>
                  </div>
                  <IconChevronRight size={15} className="text-text-secondary" />
                </div>
              </button>
            ))}
          </div>
        )}

        {applications !== null && total === 0 && (
          <div className="text-left p-8 border border-border-hairline rounded-card bg-surface-alt">
            <div className="w-[38px] h-[38px] rounded-[10px] bg-surface flex items-center justify-center mb-[14px]">
              <IconFileText size={18} className="text-text-secondary" />
            </div>
            <div className="text-base font-medium mb-1">No applications yet</div>
            <div className="text-[13.5px] text-text-secondary mb-4">
              Start your first one and see how your resume scores.
            </div>
            <button
              type="button"
              onClick={() => router.push("/applications/new")}
              className="border border-accent bg-transparent text-accent px-4 py-2 rounded-lg text-[13.5px] font-medium cursor-pointer"
            >
              New application
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

1. Sign up as a brand-new user (or use one with 0 applications), land on `/`.
2. **Verify (empty state):** header shows the wordmark, "Log out", and theme toggle; master resume banner shows per Task 3; below it, the "No applications yet" card (icon badge, heading, subtext, "New application" button) — no stats row.
3. Using the reconciliation script from Task 1 (or by actually creating applications through the app's real flow), get this user to 2+ applications, some scored-only and some optimized.
4. **Verify (populated state):** stats row shows 3 cards (Applications count, Average score, `Optimized: n/total`) with correct numbers; each application row shows role/company/status chip (Scored = neutral chip, Optimized = accent chip)/date on the left, score + chevron on the right; clicking a row navigates to `/applications/:id`.
5. Click "New application" (both the top-right button and, if you emptied the list first, the empty-state button) — confirm both navigate to `/applications/new`.
6. Click "Log out" — confirm redirect to `/login`.
7. Toggle dark/light — confirm the whole page (header, stats, banner, list, empty state) renders correctly in both themes.
8. Resize to a narrow viewport — confirm the stats grid wraps to fewer columns and nothing overflows horizontally.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: redesign dashboard with AppHeader, stats row, and status chips"
```
