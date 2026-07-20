# UI Redesign Phase C+D: Wizard + Loading Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the 3-step new-application wizard with a real stepper, split `LoadingView` into scoring/optimizing variants, and fix two pre-existing bugs: the scoring step's loading screen is mislabeled "Optimizing your resume", and the detail page's Optimize button has no full-screen loading view at all.

**Architecture:** `AppHeader` gains an optional `stepperItems` prop (additive, doesn't change dashboard's usage). `LoadingView` gains a required `variant: "scoring" | "optimizing"` prop selecting its icon/title/subtitle/messages, keeping the one existing fake-progress mechanism. The three wizard step components get a markup-only restyle (same props/logic). `app/applications/new/page.tsx` drops its local `Stepper` function in favor of `AppHeader`, and swaps `<LoadingView />` for `<LoadingView variant="scoring" />`. `app/applications/[id]/page.tsx` adopts `AppHeader` and adds the missing `<LoadingView variant="optimizing" />` swap during `optimizing === true`.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, `@tabler/icons-react` (already a dependency), `react-dropzone` (already used by `ResumeSourceStep`).

## Global Constraints

- No new dependencies.
- Tailwind utility classes only — no inline `style={}` — **except** `LoadingView`'s progress-bar `width` (a runtime percentage computed from component state; this cannot be a static Tailwind class and was already an inline style before this phase, kept as the one legitimate exception).
- Every `max-w-*` container gets `mx-auto` (standing centering principle from the Phase A spec) — Details `max-w-[440px]`, Resume `max-w-[480px]`, Job description `max-w-[600px]`, `LoadingView` `max-w-[380px]`.
- `ApplicationDetailsStep`, `ResumeSourceStep`, `JobDescriptionStep`: preserve all existing props (except `JobDescriptionStep` explicitly drops its unused `loading` prop), all existing state, all existing logic (`useDropzone` config, `canProceed`/`handleNext` computations, the `ResumeSource` exported type) — markup/className changes only.
- `app/applications/new/page.tsx`: preserve `handleSubmit`, `STEPS`, `stepIndex`, all step state, the `POST /api/score` call and its redirect — unchanged.
- `app/applications/[id]/page.tsx`: preserve `handleDelete`, `handleOptimize`, all state, the `POST /api/optimize` call — unchanged. Do **not** restyle `ScoringView`, `ResultView`, or the title/company/delete-button text styling in this file — those stay on their current (pre-redesign) classes; restyling them is Phase E's job. The only changes here are: swap the header for `AppHeader`, swap the outer page background to `bg-bg text-text-primary` (so it doesn't visually clash with the new header sitting on an old background), and add the `optimizing` → `LoadingView` swap.
- Real `<input type="radio">`/`<input type="checkbox">` elements must remain in `ResumeSourceStep` for accessibility (visually hidden via `sr-only`, not removed) — don't replace them with plain `<div onClick>` fakes.
- Keep `ThemeToggle` on every screen this phase touches (wizard, detail page) via `AppHeader`'s `rightSlot` — this app keeps the light/dark toggle everywhere, per the Phase A decision.

---

### Task 1: Add stepper support to `AppHeader`

**Files:**
- Modify: `components/AppHeader.tsx`

**Interfaces:**
- Produces: `export interface StepperItem { label: string; state: "done" | "current" | "pending"; }` and the extended `AppHeaderProps` (`rightSlot` unchanged, new optional `stepperItems?: StepperItem[]`) — consumed by Task 6 (`app/applications/new/page.tsx`).

- [ ] **Step 1: Replace the contents of `components/AppHeader.tsx`**

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface StepperItem {
  label: string;
  state: "done" | "current" | "pending";
}

interface AppHeaderProps {
  rightSlot?: ReactNode;
  stepperItems?: StepperItem[];
}

export function AppHeader({ rightSlot, stepperItems }: AppHeaderProps) {
  return (
    <div className="flex items-center gap-[17px] px-[clamp(24px,6vw,64px)] py-2">
      <Link href="/" className="text-[18px] font-medium tracking-[-0.015em] mr-auto">
        Resume<span className="text-accent">Tailor</span>
      </Link>

      {stepperItems && stepperItems.length > 0 && (
        <div className="flex items-center gap-2">
          {stepperItems.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex items-center gap-[6px]">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${
                    step.state === "done"
                      ? "bg-accent text-bg"
                      : step.state === "current"
                        ? "bg-transparent text-accent border-[1.5px] border-accent"
                        : "bg-surface text-text-secondary"
                  }`}
                >
                  {step.state === "done" ? (
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M2 5.5l2.3 2.3L9 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`hidden md:inline text-[12.5px] whitespace-nowrap ${
                    step.state === "current" ? "text-text-primary" : "text-text-secondary"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < stepperItems.length - 1 && <div className="w-[18px] h-px bg-border-hairline shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {rightSlot}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds (nothing consumes `stepperItems` yet, so this only confirms the file itself is valid).

- [ ] **Step 3: Commit**

```bash
git add components/AppHeader.tsx
git commit -m "feat: add stepper support to AppHeader"
```

---

### Task 2: Split `LoadingView` into scoring/optimizing variants

**Files:**
- Modify: `components/LoadingView.tsx`

**Interfaces:**
- Produces: `export function LoadingView({ variant }: { variant: "scoring" | "optimizing" }): JSX.Element` — consumed by Task 6 (wizard, `variant="scoring"`) and Task 7 (detail page, `variant="optimizing"`). This is a breaking change to the existing no-props signature; both call sites are updated in this same plan (Tasks 6/7), so no intermediate broken state ships.

- [ ] **Step 1: Replace the contents of `components/LoadingView.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { IconSparkles } from "@tabler/icons-react";

const SCORING_MESSAGES = [
  "Reading your resume...",
  "Parsing sections...",
  "Comparing against the job description...",
  "Identifying keyword gaps...",
  "Calculating ATS alignment...",
];

const OPTIMIZING_MESSAGES = [
  "Reviewing suggested improvements...",
  "Rewriting bullet points...",
  "Weaving in missing keywords...",
  "Polishing your summary...",
  "Finalizing your optimized resume...",
];

const BASE_RATE = 1.2;
const MAX_PROGRESS = 88;

interface LoadingViewProps {
  variant: "scoring" | "optimizing";
}

export function LoadingView({ variant }: LoadingViewProps) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = variant === "scoring" ? SCORING_MESSAGES : OPTIMIZING_MESSAGES;

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= MAX_PROGRESS) return prev;
        const increment = BASE_RATE * (1 - prev / MAX_PROGRESS);
        return Math.min(prev + increment, MAX_PROGRESS);
      });
    }, 150);

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [messages]);

  const title = variant === "scoring" ? "Scoring your resume" : "Optimizing your resume";
  const subtitle = variant === "scoring" ? "This usually takes 10–15 seconds." : "Rewriting content to match the role.";

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="flex flex-col items-center space-y-2">
        {variant === "scoring" ? (
          <div className="w-12 h-12 rounded-full border-[2.5px] border-border-hairline border-t-accent animate-spin" />
        ) : (
          <div className="w-12 h-12 rounded-xl border border-accent-surface flex items-center justify-center">
            <IconSparkles size={20} className="text-accent animate-pulse" />
          </div>
        )}
        <h2 className="text-lg font-medium text-text-primary mt-2">{title}</h2>
        <p className="text-sm text-text-secondary">{subtitle}</p>
      </div>

      <div className="w-full max-w-[380px] mx-auto space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-chip-neutral-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-text-secondary tabular-nums w-8 text-right">
            {Math.round(progress)}%
          </span>
        </div>

        <p className="text-sm text-text-secondary italic text-center">{messages[messageIndex]}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build **fails** at this point — `app/applications/new/page.tsx` still calls `<LoadingView />` with no `variant` prop. This is expected; Task 6 fixes it. Confirm the error is specifically about the missing `variant` prop (not something else), then proceed — do not fix the call site here, that's Task 6's job per the file boundaries in Global Constraints.

- [ ] **Step 3: Commit**

```bash
git add components/LoadingView.tsx
git commit -m "feat: split LoadingView into scoring/optimizing variants"
```

(Committing a change that breaks the build until Task 6 lands is intentional here — the two tasks are tightly coupled by this prop, and splitting them keeps each task's diff focused. `npm run build` in Task 6's own verification step confirms the break is fixed.)

---

### Task 3: Restyle `ApplicationDetailsStep`

**Files:**
- Modify: `components/ApplicationDetailsStep.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: same export/props as today (`ApplicationDetailsStepProps` unchanged) — consumed by Task 6, no interface change.

- [ ] **Step 1: Replace the contents of `components/ApplicationDetailsStep.tsx`**

```tsx
"use client";

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
    <div className="max-w-[440px] mx-auto">
      <div className="text-[11px] tracking-wide text-accent uppercase mb-[6px]">Application details</div>
      <div className="text-2xl font-medium mb-6 tracking-[-0.015em] text-text-primary">Where are you applying?</div>
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="companyName" className="block text-[12px] mb-[5px] text-text-secondary">
            Company
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="Acme Corp"
            className="w-full min-h-[36px] px-3 py-2 text-[15px] text-text-primary bg-surface border border-border-hairline rounded-lg outline-none"
          />
        </div>
        <div>
          <label htmlFor="roleTitle" className="block text-[12px] mb-[5px] text-text-secondary">
            Role title
          </label>
          <input
            id="roleTitle"
            type="text"
            value={roleTitle}
            onChange={(e) => onRoleTitleChange(e.target.value)}
            placeholder="Senior Backend Engineer"
            className="w-full min-h-[36px] px-3 py-2 text-[15px] text-text-primary bg-surface border border-border-hairline rounded-lg outline-none"
          />
        </div>
        <div className="flex justify-end mt-1.5">
          <button
            type="button"
            disabled={!canProceed}
            onClick={onNext}
            className="flex items-center gap-[7px] px-[18px] py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 6.5h9M7 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: this file itself introduces no new errors (the pre-existing break from Task 2 is unrelated and still present — ignore it here).

- [ ] **Step 3: Commit**

```bash
git add components/ApplicationDetailsStep.tsx
git commit -m "feat: restyle ApplicationDetailsStep with redesign tokens"
```

---

### Task 4: Restyle `ResumeSourceStep`

**Files:**
- Modify: `components/ResumeSourceStep.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: same exports as today (`ResumeSource` type, `ResumeSourceStepProps`) — unchanged, consumed by Task 6.

- [ ] **Step 1: Replace the contents of `components/ResumeSourceStep.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { IconFileUpload, IconCheck, IconArrowLeft, IconArrowRight } from "@tabler/icons-react";

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
    <div className="max-w-[480px] mx-auto">
      <div className="text-[11px] tracking-wide text-accent uppercase mb-[6px]">Resume</div>
      <div className="text-2xl font-medium mb-6 tracking-[-0.015em] text-text-primary">Which resume should we score?</div>

      <div className="flex flex-col gap-[11px]">
        {hasMaster && (
          <label
            className={`flex items-center gap-3 px-[15px] py-[13px] rounded-lg cursor-pointer ${
              !useUpload ? "bg-surface shadow-[0_0_0_1px_var(--color-accent)]" : "shadow-[0_0_0_1px_var(--color-border-hairline)]"
            }`}
          >
            <input type="radio" name="resumeSource" checked={!useUpload} onChange={() => setUseUpload(false)} className="sr-only" />
            <span
              className={`w-4 h-4 rounded-full border-[1.5px] shrink-0 ${
                !useUpload ? "border-accent bg-accent shadow-[inset_0_0_0_3px_var(--color-bg)]" : "border-border-hairline"
              }`}
            />
            <span className="text-sm text-text-primary">
              Use my master resume — <span className="text-text-secondary">{masterResumeFileName}</span>
            </span>
          </label>
        )}

        <label
          className={`flex items-center gap-3 px-[15px] py-[13px] rounded-lg cursor-pointer ${
            useUpload ? "bg-surface shadow-[0_0_0_1px_var(--color-accent)]" : "shadow-[0_0_0_1px_var(--color-border-hairline)]"
          }`}
        >
          <input type="radio" name="resumeSource" checked={useUpload} onChange={() => setUseUpload(true)} className="sr-only" />
          <span
            className={`w-4 h-4 rounded-full border-[1.5px] shrink-0 ${
              useUpload ? "border-accent bg-accent shadow-[inset_0_0_0_3px_var(--color-bg)]" : "border-border-hairline"
            }`}
          />
          <span className="text-sm text-text-primary">Upload a different resume for this application</span>
        </label>

        {showUpload && (
          <>
            <div
              {...getRootProps()}
              className={`border border-dashed rounded-lg px-5 py-[26px] text-center bg-surface-alt cursor-pointer ${
                isDragActive ? "border-accent" : "border-border-dashed"
              }`}
            >
              <input {...getInputProps()} />
              {file ? (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="mx-auto mb-[10px] text-accent">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="text-sm text-text-primary">{file.name}</div>
                  <div className="text-xs text-text-secondary mt-1">{formatBytes(file.size)}</div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-[12.5px] text-accent mt-1 cursor-pointer bg-transparent border-none"
                  >
                    Choose a different file
                  </button>
                </>
              ) : (
                <>
                  <IconFileUpload size={22} className="mx-auto mb-[10px] text-text-secondary" />
                  <div className="text-sm text-text-primary mb-[2px]">Drop your resume here</div>
                  <div className="text-xs text-text-secondary mb-[14px]">PDF or DOCX · up to 5MB</div>
                  <span className="inline-block px-[14px] py-[7px] border border-border-hairline rounded-lg text-[13px] text-text-primary">
                    Browse files
                  </span>
                </>
              )}
            </div>

            {!hasMaster && (
              <label className="flex items-center gap-2 pl-[2px] cursor-pointer">
                <span
                  onClick={() => setSaveAsMaster((v) => !v)}
                  className={`w-[15px] h-[15px] rounded-[3px] border-[1.5px] flex items-center justify-center shrink-0 ${
                    saveAsMaster ? "border-accent bg-accent" : "border-border-hairline"
                  }`}
                >
                  {saveAsMaster && <IconCheck size={9} className="text-bg" strokeWidth={3} />}
                </span>
                <input
                  type="checkbox"
                  checked={saveAsMaster}
                  onChange={(e) => setSaveAsMaster(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-[13px] text-text-secondary">Save this as my new master resume</span>
              </label>
            )}
          </>
        )}

        <div className="flex justify-between mt-[8px]">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-[7px] px-4 py-[9px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer"
          >
            <IconArrowLeft size={13} />
            Back
          </button>
          <button
            type="button"
            disabled={!canProceed}
            onClick={handleNext}
            className="flex items-center gap-[7px] px-[18px] py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            Next
            <IconArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: this file introduces no new errors (the pre-existing Task 2 break is unrelated).

- [ ] **Step 3: Commit**

```bash
git add components/ResumeSourceStep.tsx
git commit -m "feat: restyle ResumeSourceStep with redesign tokens"
```

---

### Task 5: Restyle `JobDescriptionStep` and drop its unused `loading` prop

**Files:**
- Modify: `components/JobDescriptionStep.tsx`

**Interfaces:**
- Produces: `JobDescriptionStepProps` **without** `loading` (breaking change — the only caller, `app/applications/new/page.tsx`, still passes it until Task 6 removes that prop; TypeScript's excess-property checking on JSX only fires for object literals passed directly as props, which this is, so this WILL surface as a build error until Task 6 lands, same pattern as Task 2).

- [ ] **Step 1: Replace the contents of `components/JobDescriptionStep.tsx`**

```tsx
"use client";

interface JobDescriptionStepProps {
  jobDescription: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}

export function JobDescriptionStep({
  jobDescription,
  onChange,
  onBack,
  onSubmit,
}: JobDescriptionStepProps) {
  return (
    <div className="max-w-[600px] mx-auto">
      <div className="text-[11px] tracking-wide text-accent uppercase mb-[6px]">Job description</div>
      <div className="text-2xl font-medium mb-2 tracking-[-0.015em] text-text-primary">Paste the job description</div>
      <div className="text-[13.5px] text-text-secondary mb-[18px]">
        The more detail you give us, the sharper the scoring.
      </div>
      <textarea
        placeholder="Paste the job description here — role, responsibilities, requirements..."
        value={jobDescription}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        className="w-full min-h-[90px] px-[14px] py-3 text-text-primary bg-surface border border-border-hairline rounded-lg outline-none resize-y text-[14.5px] leading-[1.55]"
      />
      <div className="flex justify-between mt-[18px]">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-[7px] px-4 py-[9px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5H2M6 2.5l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <button
          type="button"
          disabled={!jobDescription.trim()}
          onClick={onSubmit}
          className="flex items-center gap-2 px-[18px] py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1l1.2 3.8L12 6l-3.8 1.2L7 11l-1.2-3.8L2 6l3.8-1.2L7 1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          </svg>
          Score my resume
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build **fails** — `app/applications/new/page.tsx` still passes `loading={loading}` to `JobDescriptionStep`, which no longer accepts it. Expected and fixed by Task 6, same pattern as Task 2.

- [ ] **Step 3: Commit**

```bash
git add components/JobDescriptionStep.tsx
git commit -m "feat: restyle JobDescriptionStep and drop unused loading prop"
```

---

### Task 6: Wire the wizard page (`app/applications/new/page.tsx`)

**Files:**
- Modify: `app/applications/new/page.tsx`

**Interfaces:**
- Consumes: `AppHeader`, `StepperItem` from `@/components/AppHeader` (Task 1); `LoadingView` from `@/components/LoadingView` now requiring `variant` (Task 2); restyled `ApplicationDetailsStep`/`ResumeSourceStep`/`JobDescriptionStep` (Tasks 3-5, `JobDescriptionStep` no longer takes `loading`); `ThemeToggle` from `@/components/ThemeToggle` (unchanged).
- This task's build passing is what confirms Tasks 2 and 5's intentional breaks are resolved.

- [ ] **Step 1: Replace the contents of `app/applications/new/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApplicationDetailsStep } from "@/components/ApplicationDetailsStep";
import { ResumeSourceStep, type ResumeSource } from "@/components/ResumeSourceStep";
import { JobDescriptionStep } from "@/components/JobDescriptionStep";
import { LoadingView } from "@/components/LoadingView";
import { AppHeader, type StepperItem } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
import { useMasterResume } from "@/lib/hooks/useMasterResume";

type Step = "details" | "resume" | "jobDescription";

const STEPS: { key: Step; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "resume", label: "Resume" },
  { key: "jobDescription", label: "Job description" },
];

function stepIndex(step: Step): number {
  return STEPS.findIndex((s) => s.key === step);
}

interface ScoreResponse {
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

      const res = await authFetch("/api/score", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : "Scoring failed");
      }
      const data: ScoreResponse = await res.json();
      router.push(`/applications/${data.applicationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (!ready || !accessToken || !masterResumeLoaded) {
    return null;
  }

  const currentIndex = stepIndex(step);
  const stepperItems: StepperItem[] = STEPS.map((s, i) => ({
    label: s.label,
    state: i < currentIndex ? "done" : i === currentIndex ? "current" : "pending",
  }));

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <AppHeader stepperItems={loading ? undefined : stepperItems} rightSlot={<ThemeToggle />} />

      <main className="px-[clamp(24px,6vw,64px)] py-10">
        {error && (
          <p className="mb-6 max-w-[600px] mx-auto rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {loading && <LoadingView variant="scoring" />}

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
          />
        )}
      </main>
    </div>
  );
}
```

Note: the stepper hides during `loading` (`loading ? undefined : stepperItems`) — this matches the reference, which doesn't show a step indicator on its loading screens either (they're a distinct screen state, not "step 4 of 3").

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds — this resolves the intentional breaks left by Tasks 2 and 5.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Visit `http://localhost:3000/applications/new`.
2. **Verify:** header shows wordmark, the 3-dot stepper (Details highlighted, Resume/Job description pending), and `ThemeToggle` on the right.
3. Fill in Company + Role, click Next.
4. **Verify:** stepper updates (Details shows a checkmark, Resume is now current); "Which resume should we score?" step renders with the redesign tokens.
5. Select or upload a resume, click Next.
6. **Verify:** stepper updates again; job description textarea renders, "Score my resume" button disabled until text is entered.
7. Paste a job description, click "Score my resume".
8. **Verify:** the whole step area (including the stepper) is replaced by the scoring `LoadingView` — spinning ring icon, "Scoring your resume", "This usually takes 10–15 seconds.", cycling messages, progress bar advancing and capping under 100%.
9. **Verify:** on completion, redirects to `/applications/:id`.
10. Click Back at each step — confirm previously entered data (company/role, resume choice, job description) is preserved, not reset.
11. Toggle dark/light at each step — confirm tokens render correctly in both.

- [ ] **Step 4: Commit**

```bash
git add app/applications/new/page.tsx
git commit -m "feat: wire AppHeader stepper and scoring LoadingView into the wizard"
```

---

### Task 7: Wire the detail page (`app/applications/[id]/page.tsx`)

**Files:**
- Modify: `app/applications/[id]/page.tsx`

**Interfaces:**
- Consumes: `AppHeader` from `@/components/AppHeader` (Task 1, no `stepperItems` needed here); `LoadingView` from `@/components/LoadingView` (Task 2, `variant="optimizing"`); `ScoringView`, `ResultView`, `ThemeToggle` (all unchanged, not restyled in this task).

- [ ] **Step 1: Replace the contents of `app/applications/[id]/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ResultView } from "@/components/ResultView";
import { ScoringView } from "@/components/ScoringView";
import { LoadingView } from "@/components/LoadingView";
import { AppHeader } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth/AuthContext";
import { authFetch } from "@/lib/auth/authFetch";
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
    <div className="min-h-screen bg-bg text-text-primary">
      <AppHeader rightSlot={<ThemeToggle />} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        {error && (
          <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        {!application && !error && <p className="text-sm text-gray-400 dark:text-gray-500">Loading...</p>}

        {application && optimizing && <LoadingView variant="optimizing" />}

        {application && !optimizing && (
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

Note: only the outer page background (`bg-bg text-text-primary`) and the header change to redesign tokens here — the title, company label, delete button, `ScoringView`, and `ResultView` deliberately keep their current (pre-redesign) `gray-*`/`blue-*` classes, per the Global Constraints. This will look like a partially-redesigned page until Phase E restyles `ScoringView`/`ResultView` — that's expected and correct for this phase's scope, not a bug to fix here.

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Open an existing scored (not yet optimized) application's detail page, e.g. `http://localhost:3000/applications/<id>`.
2. **Verify:** header now shows the redesigned wordmark + `ThemeToggle` (no stepper — this page doesn't pass `stepperItems`).
3. Click "Optimize this resume" (inside `ScoringView`).
4. **Verify:** the entire content area — including the company/role/delete-button block — is replaced by the optimizing `LoadingView`: sparkle icon in a rounded box, "Optimizing your resume", "Rewriting content to match the role.", its own cycling message set, progress bar.
5. **Verify:** on completion, the company/role block reappears and `ResultView` renders (since `resumeData` is now non-null).
6. Reload the page directly on an already-optimized application — confirm `ResultView` renders immediately, no loading flash.
7. Click "Delete this application" on a scored application — confirm it still redirects to `/` (delete logic untouched).

- [ ] **Step 4: Commit**

```bash
git add app/applications/[id]/page.tsx
git commit -m "feat: wire AppHeader and optimizing LoadingView into the detail page"
```
