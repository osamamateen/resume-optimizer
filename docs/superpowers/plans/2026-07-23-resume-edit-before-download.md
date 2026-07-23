# Resume Edit Before Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user edit the AI-optimized resume's structured data on a dedicated `/applications/[id]/edit` screen, save the edits (persisted via a new `PATCH` endpoint), and then download a PDF that reflects them.

**Architecture:** A new `PATCH /api/applications/[id]` route validates and persists an edited `ResumeData` object onto the existing `Application.resumeData` column. A new `/applications/[id]/edit` page fetches the application, guards on `resumeData` being non-null, and renders a new `ResumeEditor` client component built from two small reusable pieces (`ListEditor` for arrays of objects, `TagListEditor` for string arrays). `ResultView` gets an "Edit resume" link into that page; saving routes back to the detail page, which re-fetches and shows the edited data ready for download.

**Tech Stack:** Next.js 16 (App Router, Webpack), React 19, TypeScript (strict), Tailwind v4, Prisma 6.19.3 / Postgres, Zod v4. No test runner in this repo — verification is `npx tsc --noEmit` + `npm run lint` + manual checks against the dev server (`npm run dev`), per this project's established convention (see `docs/superpowers/specs/2026-07-23-resume-edit-before-download-design.md`).

## Global Constraints

- Every API route starts with `requireAuth(req)` and returns `{ "error": "Unauthorized" }` / 401 on failure, matching every existing route in `app/api/`.
- Score, matched/missing keywords, and summary-of-changes are never recomputed or modified by this feature — only `resumeData` changes.
- No validation beyond what `ResumeDataSchema` already enforces (empty strings are allowed through, matching existing behavior).
- Follow existing Tailwind class conventions exactly as used in `ResultView.tsx` / `ScoringView.tsx` / `ApplicationDetailsStep.tsx` (e.g. `bg-surface`, `border-border-hairline`, `text-text-primary`, `text-text-secondary`, `text-accent`, `rounded-lg`) — do not introduce new design tokens.
- Reordering within `TagListEditor` (bullets, skills, technologies) is explicitly out of scope.
- Recomputing ATS score after edits, autosave, and concurrent-edit conflict handling are explicitly out of scope.

---

### Task 1: `PATCH /api/applications/[id]` endpoint

**Files:**
- Modify: `app/api/applications/[id]/route.ts`

**Interfaces:**
- Consumes: `ResumeDataSchema` from `@/types/resume.types` (already exists); `loadOwnedApplication(id, userId)` (already defined in this file); `requireAuth`, `UnauthorizedError` from `@/lib/auth/requireAuth`; `prisma` from `@/lib/prisma`.
- Produces: `PATCH` handler returning the same JSON shape as the existing `GET` handler in this file (so the edit page's save flow and the detail page's fetch flow can share one response type). Later tasks (the edit page) call this endpoint with `PATCH`, body `{ resumeData: ResumeData }`.

- [ ] **Step 1: Add the `ResumeDataSchema` import**

In `app/api/applications/[id]/route.ts`, add to the top imports:

```ts
import { ResumeDataSchema } from "@/types/resume.types";
```

- [ ] **Step 2: Add the `PATCH` handler**

Add this function after the existing `GET` handler (before `DELETE`) in `app/api/applications/[id]/route.ts`:

```ts
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (application.resumeData === null) {
    return NextResponse.json({ error: "This resume hasn't been optimized yet" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { resumeData } = (body ?? {}) as { resumeData?: unknown };
  const parsed = ResumeDataSchema.safeParse(resumeData);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resume data", details: parsed.error.format() }, { status: 400 });
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { resumeData: parsed.data },
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
    summaryOfChanges: updated.summaryHeadline
      ? { headline: updated.summaryHeadline, bullets: updated.summaryBullets }
      : null,
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

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, log in, open an application that has already been optimized (has `resumeData`), e.g. `/applications/<id>`. In the browser devtools console (while on that page) run:

```js
const { accessToken } = JSON.parse(localStorage.getItem("resume-optimizer-auth"));
const id = location.pathname.split("/").pop();
fetch(`/api/applications/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
  .then((r) => r.json())
  .then((app) =>
    fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ resumeData: { ...app.resumeData, summary: "Edited via PATCH test" } }),
    })
  )
  .then((r) => r.json())
  .then(console.log);
```

Expected: response JSON with `resumeData.summary === "Edited via PATCH test"`. Reload the page and confirm the summary now reads "Edited via PATCH test" (no UI wiring yet, but the DB write persisted, so `GET` returns the new value on reload). Also verify calling `PATCH` on an application whose `resumeData` is still `null` (a freshly-scored, not-yet-optimized application) returns 409.

- [ ] **Step 5: Commit**

```bash
git add app/api/applications/[id]/route.ts
git commit -m "feat: add PATCH endpoint to save edited resume data"
```

---

### Task 2: `TagListEditor` component

**Files:**
- Create: `components/resume/TagListEditor.tsx`

**Interfaces:**
- Consumes: nothing project-specific (plain React state).
- Produces: `TagListEditor` component with props `{ label: string; values: string[]; onChange: (values: string[]) => void; placeholder?: string }`. Used by Task 4 (`ResumeEditor`) for bullets, skills categories, and project technologies.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";

interface TagListEditorProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function TagListEditor({ label, values, onChange, placeholder }: TagListEditorProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([...values, trimmed]);
    setDraft("");
  }

  function removeTag(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  return (
    <div>
      <label className="block text-[12px] mb-[5px] text-text-secondary">{label}</label>
      <div className="flex flex-wrap gap-[6px] mb-2">
        {values.map((value, index) => (
          <span
            key={index}
            className="flex items-center gap-[6px] text-[11px] px-[10px] py-[3px] rounded-md bg-chip-neutral-bg text-chip-neutral-text"
          >
            {value}
            <button
              type="button"
              onClick={() => removeTag(index)}
              aria-label={`Remove ${value}`}
              className="cursor-pointer leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-h-[34px] px-3 py-2 text-[13.5px] text-text-primary bg-surface border border-border-hairline rounded-lg outline-none"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-2 border border-border-hairline rounded-lg bg-transparent text-text-primary text-[13px] cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/resume/TagListEditor.tsx
git commit -m "feat: add TagListEditor component for editing string-array fields"
```

---

### Task 3: `ListEditor` component

**Files:**
- Create: `components/resume/ListEditor.tsx`

**Interfaces:**
- Consumes: nothing project-specific (generic React component).
- Produces: generic `ListEditor<T>` component with props `{ items: T[]; onChange: (items: T[]) => void; createItem: () => T; renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode; addLabel: string; emptyLabel?: string }`. Used by Task 4 (`ResumeEditor`) for experience, education, projects, and custom sections.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { ReactNode } from "react";

interface ListEditorProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
  addLabel: string;
  emptyLabel?: string;
}

export function ListEditor<T>({ items, onChange, createItem, renderItem, addLabel, emptyLabel }: ListEditorProps<T>) {
  function updateItem(index: number, patch: Partial<T>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 && emptyLabel && <p className="text-[13px] text-text-secondary">{emptyLabel}</p>}
      {items.map((item, index) => (
        <div key={index} className="bg-surface border border-border-hairline rounded-lg p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => moveItem(index, -1)}
                disabled={index === 0}
                aria-label="Move up"
                className="px-2 py-1 border border-border-hairline rounded-md bg-transparent text-text-secondary text-[11px] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(index, 1)}
                disabled={index === items.length - 1}
                aria-label="Move down"
                className="px-2 py-1 border border-border-hairline rounded-md bg-transparent text-text-secondary text-[11px] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-[12px] text-red-600 dark:text-red-400 cursor-pointer"
            >
              Remove
            </button>
          </div>
          {renderItem(item, (patch) => updateItem(index, patch))}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, createItem()])}
        className="w-full px-4 py-[9px] border border-dashed border-border-hairline rounded-lg bg-transparent text-text-secondary text-[13px] cursor-pointer"
      >
        {addLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/resume/ListEditor.tsx
git commit -m "feat: add generic ListEditor component for editing array-of-object fields"
```

---

### Task 4: `ResumeEditor` component

**Files:**
- Create: `components/resume/ResumeEditor.tsx`

**Interfaces:**
- Consumes: `ResumeData` type from `@/types/resume.types`; `ListEditor` from `@/components/resume/ListEditor` (Task 3); `TagListEditor` from `@/components/resume/TagListEditor` (Task 2).
- Produces: `ResumeEditor` component with props `{ initialData: ResumeData; onSave: (data: ResumeData) => void; onCancel: () => void; saving: boolean; error: string | null }`. Used by Task 5 (edit page).

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import type { ResumeData } from "@/types/resume.types";
import { ListEditor } from "@/components/resume/ListEditor";
import { TagListEditor } from "@/components/resume/TagListEditor";

type ExperienceEntry = ResumeData["experience"][number];
type EducationEntry = ResumeData["education"][number];
type ProjectEntry = NonNullable<ResumeData["projects"]>[number];
type CustomSectionEntry = NonNullable<ResumeData["customSections"]>[number];

interface ResumeEditorProps {
  initialData: ResumeData;
  onSave: (data: ResumeData) => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

const inputClass =
  "w-full min-h-[36px] px-3 py-2 text-[14px] text-text-primary bg-surface border border-border-hairline rounded-lg outline-none";

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-[12px] mb-[5px] text-text-secondary">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  );
}

export function ResumeEditor({ initialData, onSave, onCancel, saving, error }: ResumeEditorProps) {
  const [data, setData] = useState<ResumeData>(initialData);

  function updateContact(patch: Partial<ResumeData["contact"]>) {
    setData((d) => ({ ...d, contact: { ...d.contact, ...patch } }));
  }

  const skills = data.skills ?? { languages: [], frameworks: [], tools: [], other: [] };
  function updateSkills(patch: Partial<NonNullable<ResumeData["skills"]>>) {
    setData((d) => ({ ...d, skills: { ...skills, ...patch } }));
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Contact</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name" value={data.contact.name} onChange={(v) => updateContact({ name: v })} />
          <Field label="Email" value={data.contact.email} onChange={(v) => updateContact({ email: v })} />
          <Field label="Phone" value={data.contact.phone} onChange={(v) => updateContact({ phone: v })} />
          <Field label="Location" value={data.contact.location} onChange={(v) => updateContact({ location: v })} />
          <Field label="LinkedIn" value={data.contact.linkedin ?? ""} onChange={(v) => updateContact({ linkedin: v })} />
          <Field label="GitHub" value={data.contact.github ?? ""} onChange={(v) => updateContact({ github: v })} />
          <Field label="Website" value={data.contact.website ?? ""} onChange={(v) => updateContact({ website: v })} />
        </div>
      </div>

      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Summary</div>
        <textarea
          value={data.summary ?? ""}
          onChange={(e) => setData((d) => ({ ...d, summary: e.target.value }))}
          rows={4}
          className="w-full px-[14px] py-3 text-text-primary bg-surface border border-border-hairline rounded-lg outline-none resize-y text-[14px] leading-[1.55]"
        />
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Experience</div>
        <ListEditor<ExperienceEntry>
          items={data.experience}
          onChange={(items) => setData((d) => ({ ...d, experience: items }))}
          createItem={() => ({ title: "", company: "", location: "", startDate: "", endDate: "", bullets: [] })}
          addLabel="Add experience"
          emptyLabel="No experience entries yet."
          renderItem={(item, update) => (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Title" value={item.title} onChange={(v) => update({ title: v })} />
                <Field label="Company" value={item.company} onChange={(v) => update({ company: v })} />
                <Field label="Location" value={item.location ?? ""} onChange={(v) => update({ location: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date" value={item.startDate} onChange={(v) => update({ startDate: v })} />
                  <Field label="End date" value={item.endDate} onChange={(v) => update({ endDate: v })} />
                </div>
              </div>
              <TagListEditor
                label="Bullets"
                values={item.bullets}
                onChange={(bullets) => update({ bullets })}
                placeholder="Add a bullet and press Enter"
              />
            </div>
          )}
        />
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Education</div>
        <ListEditor<EducationEntry>
          items={data.education}
          onChange={(items) => setData((d) => ({ ...d, education: items }))}
          createItem={() => ({ institution: "", degree: "", field: "", graduationDate: "" })}
          addLabel="Add education"
          emptyLabel="No education entries yet."
          renderItem={(item, update) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Institution" value={item.institution} onChange={(v) => update({ institution: v })} />
              <Field label="Degree" value={item.degree} onChange={(v) => update({ degree: v })} />
              <Field label="Field" value={item.field ?? ""} onChange={(v) => update({ field: v })} />
              <Field label="Graduation date" value={item.graduationDate} onChange={(v) => update({ graduationDate: v })} />
            </div>
          )}
        />
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Projects</div>
        <ListEditor<ProjectEntry>
          items={data.projects ?? []}
          onChange={(items) => setData((d) => ({ ...d, projects: items }))}
          createItem={() => ({ name: "", description: "", technologies: [], bullets: [] })}
          addLabel="Add project"
          emptyLabel="No projects yet."
          renderItem={(item, update) => (
            <div className="flex flex-col gap-3">
              <Field label="Name" value={item.name} onChange={(v) => update({ name: v })} />
              <Field label="Description" value={item.description ?? ""} onChange={(v) => update({ description: v })} />
              <TagListEditor
                label="Technologies"
                values={item.technologies}
                onChange={(technologies) => update({ technologies })}
                placeholder="Add a technology and press Enter"
              />
              <TagListEditor
                label="Bullets"
                values={item.bullets}
                onChange={(bullets) => update({ bullets })}
                placeholder="Add a bullet and press Enter"
              />
            </div>
          )}
        />
      </div>

      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Skills</div>
        <div className="flex flex-col gap-4">
          <TagListEditor
            label="Languages"
            values={skills.languages}
            onChange={(v) => updateSkills({ languages: v })}
            placeholder="Add a language and press Enter"
          />
          <TagListEditor
            label="Frameworks"
            values={skills.frameworks}
            onChange={(v) => updateSkills({ frameworks: v })}
            placeholder="Add a framework and press Enter"
          />
          <TagListEditor
            label="Tools"
            values={skills.tools}
            onChange={(v) => updateSkills({ tools: v })}
            placeholder="Add a tool and press Enter"
          />
          <TagListEditor
            label="Other"
            values={skills.other}
            onChange={(v) => updateSkills({ other: v })}
            placeholder="Add a skill and press Enter"
          />
        </div>
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Custom sections</div>
        <ListEditor<CustomSectionEntry>
          items={data.customSections ?? []}
          onChange={(items) => setData((d) => ({ ...d, customSections: items }))}
          createItem={() => ({ label: "", content: "" })}
          addLabel="Add custom section"
          emptyLabel="No custom sections yet."
          renderItem={(item, update) => (
            <div className="flex flex-col gap-3">
              <Field label="Label" value={item.label} onChange={(v) => update({ label: v })} />
              <div>
                <label className="block text-[12px] mb-[5px] text-text-secondary">Content</label>
                <textarea
                  value={item.content}
                  onChange={(e) => update({ content: e.target.value })}
                  rows={3}
                  className="w-full px-[14px] py-3 text-text-primary bg-surface border border-border-hairline rounded-lg outline-none resize-y text-[14px] leading-[1.55]"
                />
              </div>
            </div>
          )}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-[9px]">
        <button
          type="button"
          onClick={() => onSave(data)}
          disabled={saving}
          className="w-full flex items-center justify-center gap-[9px] px-4 py-3 border border-accent rounded-lg bg-transparent text-accent text-[15px] font-medium disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-[11px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/resume/ResumeEditor.tsx
git commit -m "feat: add ResumeEditor component for editing resume data"
```

---

### Task 5: Edit page — `/applications/[id]/edit`

**Files:**
- Create: `app/applications/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `ResumeEditor` from `@/components/resume/ResumeEditor` (Task 4); `AppHeader` from `@/components/AppHeader`; `ThemeToggle` from `@/components/ThemeToggle`; `Skeleton` from `@/components/Skeleton`; `useAuth` from `@/lib/auth/AuthContext`; `authFetch` from `@/lib/auth/authFetch`; `ResumeData` type from `@/types/resume.types`; the `PATCH /api/applications/[id]` endpoint from Task 1.
- Produces: page at route `/applications/[id]/edit`. Linked to from Task 6 (`ResultView`'s "Edit resume" button).

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { AppHeader } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import type { ResumeData } from "@/types/resume.types";

interface ApplicationDetail {
  id: string;
  resumeData: ResumeData | null;
}

export default function ResumeEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { accessToken, ready } = useAuth();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        const data: ApplicationDetail = await res.json();
        if (data.resumeData === null) {
          router.push(`/applications/${params.id}`);
          return;
        }
        setApplication(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load application"));
  }, [accessToken, params.id, router]);

  async function handleSave(resumeData: ResumeData) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch(`/api/applications/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Save failed");
      }
      router.push(`/applications/${params.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !accessToken) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <AppHeader rightSlot={<ThemeToggle />} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {!application && !error && (
          <div className="space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-40 w-full mt-4" />
          </div>
        )}

        {application && application.resumeData && (
          <>
            <div className="text-2xl font-medium tracking-[-0.015em] text-text-primary">Edit resume</div>
            <ResumeEditor
              initialData={application.resumeData}
              onSave={handleSave}
              onCancel={() => router.push(`/applications/${params.id}`)}
              saving={saving}
              error={saveError}
            />
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Navigate directly to `/applications/<id>/edit` for an application that has **not** been optimized yet (no `resumeData`) — confirm it redirects to `/applications/<id>`. Then navigate to `/applications/<id>/edit` for an optimized application — confirm the form renders pre-filled with the current resume data, editing fields works, and clicking "Save changes" redirects back to the detail page. Clicking "Cancel" should also redirect back, discarding any in-progress edits.

- [ ] **Step 4: Commit**

```bash
git add app/applications/\[id\]/edit/page.tsx
git commit -m "feat: add resume edit page"
```

---

### Task 6: Wire "Edit resume" into `ResultView`

**Files:**
- Modify: `components/ResultView.tsx`

**Interfaces:**
- Consumes: `Link` from `next/link`; `useParams` from `next/navigation`; the `/applications/[id]/edit` route from Task 5.
- Produces: nothing consumed by later tasks — this is the final task.

- [ ] **Step 1: Add imports and an "Edit resume" link above the download button**

In `components/ResultView.tsx`, add to the top imports:

```ts
import Link from "next/link";
import { useParams } from "next/navigation";
```

Inside the `ResultView` function body, add near the top (alongside the other hooks):

```ts
const params = useParams<{ id: string }>();
```

Then in the JSX, immediately before the `<button type="button" onClick={handleDownload} ...>` element (inside the `<div className="flex flex-col gap-[9px]">` footer), add:

```tsx
<Link
  href={`/applications/${params.id}/edit`}
  className="w-full flex items-center justify-center gap-[9px] px-4 py-3 border border-border-hairline rounded-lg bg-transparent text-text-primary text-[15px] font-medium cursor-pointer"
>
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path
      d="M2 13h2.2l7-7-2.2-2.2-7 7V13zM10 2.5L12.5 5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
  Edit resume
</Link>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification (end-to-end)**

Run `npm run dev`. Full flow: log in → optimize an application → on `/applications/<id>`, click "Edit resume" → confirm it navigates to `/applications/<id>/edit` with the form pre-filled → edit the contact name, add a bullet to an experience entry, add a skill, remove an education entry → click "Save changes" → confirm it redirects to `/applications/<id>` and `ResultView` reflects every edit (name, new bullet, new skill, removed education entry) → click "Download PDF" and confirm the downloaded PDF reflects the edits.

- [ ] **Step 5: Commit**

```bash
git add components/ResultView.tsx
git commit -m "feat: link ResultView to the resume edit page"
```

---

## Self-Review Notes

- **Spec coverage:** Flow (spec §Flow) → Tasks 1, 5, 6. PATCH endpoint (spec §API change) → Task 1. `ResumeEditor` sections (spec §UI) → Task 4. `ListEditor` (spec) → Task 3. `TagListEditor` (spec) → Task 2. Out-of-scope items (no recompute, no reordering of tags, no autosave) are respected — nothing in any task implements them.
- **Placeholder scan:** none found — every step has complete code or an exact command with expected output.
- **Type consistency:** `ResumeData`, `ExperienceEntry`, `EducationEntry`, `ProjectEntry`, `CustomSectionEntry` are all derived via `ResumeData["..."]` / `NonNullable<...>` indexing rather than hand-duplicated, so they can't drift from `types/resume.types.ts`. `ListEditor<T>` / `TagListEditor` prop names (`items`, `onChange`, `createItem`, `renderItem`, `addLabel`, `emptyLabel` / `label`, `values`, `onChange`, `placeholder`) are used identically in Task 4 as defined in Tasks 2–3. `ResumeEditor` props (`initialData`, `onSave`, `onCancel`, `saving`, `error`) match how Task 5's page constructs and calls it.
