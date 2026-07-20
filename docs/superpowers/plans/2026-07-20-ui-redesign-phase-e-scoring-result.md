# UI Redesign Phase E: Scoring View + Result View + Template Preview Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle `ScoringView`, `ResultView`, and `TemplateSelector` with the established design tokens, add animated score gauges via a shared `useCountUp` hook, and add a new `TemplatePreviewModal` (placeholder preview content, real images to follow in a later pass).

**Architecture:** `lib/hooks/useCountUp.ts` is a new standalone hook (rAF-based number animation) consumed by both `ScoringView` and `ResultView`'s gauges. `TemplatePreviewModal` is a new standalone component. `TemplateSelector` gains local `previewTemplateId` state and renders the modal. `ScoringView`/`ResultView` keep their exact current props/logic — restyle only.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, `@tabler/icons-react` (already a dependency).

## Global Constraints

- No new dependencies.
- Tailwind utility classes for all styling — **except** SVG `strokeDasharray`/`strokeDashoffset` attributes, which are computed numeric SVG presentation attributes (not CSS `style`), the same category of exception as `LoadingView`'s progress-bar width from Phase C+D. Stroke *colors* still use Tailwind classes (`className="stroke-accent"` etc.), only the dash geometry is a JSX attribute.
- Every `max-w-*` container gets `mx-auto`; the template-preview modal is a `fixed inset-0 flex items-center justify-center` overlay (standing centering principle).
- `ScoringView`, `ResultView`, `TemplateSelector`: preserve all existing props exactly. `ResultView`'s `keywordsAdded` normalization logic (`normalize`/`previousMissingNormalized`/filter) and `handleDownload` (real promise-driven `downloading` state, no timer) must not change — restyle their surrounding markup only.
- `TemplateSelector`'s `ModernPreview`/`MinimalPreview` SVG components and the `PREVIEWS` lookup stay exactly as they are (unchanged placeholder mock content) — this phase only restyles the card chrome around them and adds the Preview link/modal.
- The "before" gauge in `ResultView` uses the literal muted color `#75798c` (from the original handoff's token list, distinct from anything in the Phase A `--color-*` set) — this is a deliberate one-off literal, not an omission; don't invent a new token for a single use.

---

### Task 1: Add the `useCountUp` hook

**Files:**
- Create: `lib/hooks/useCountUp.ts`

**Interfaces:**
- Produces: `export function useCountUp(from: number, to: number, durationMs?: number): number` — consumed by Task 2 (`ScoringView`) and Task 5 (`ResultView`).

- [ ] **Step 1: Create `lib/hooks/useCountUp.ts`**

```ts
"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(from: number, to: number, durationMs = 950): number {
  const [value, setValue] = useState(from);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    setValue(from);

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [from, to, durationMs]);

  return value;
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds (nothing consumes the hook yet).

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useCountUp.ts
git commit -m "feat: add useCountUp hook for animated score gauges"
```

---

### Task 2: Restyle `ScoringView`

**Files:**
- Modify: `components/ScoringView.tsx`

**Interfaces:**
- Consumes: `useCountUp` from `@/lib/hooks/useCountUp` (Task 1).
- Produces: same `ScoringViewProps` as today, unchanged — consumed by `app/applications/[id]/page.tsx` (Phase C+D, not touched by this task).

- [ ] **Step 1: Replace the contents of `components/ScoringView.tsx`**

```tsx
"use client";

import { useCountUp } from "@/lib/hooks/useCountUp";

interface ScoringViewProps {
  atsScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  suggestions: { headline: string; bullets: string[] };
  onOptimize: () => void;
  optimizing: boolean;
  error: string | null;
}

const CIRCUMFERENCE = 326.7;

export function ScoringView({
  atsScore,
  matchedKeywords,
  missingKeywords,
  suggestions,
  onOptimize,
  optimizing,
  error,
}: ScoringViewProps) {
  const displayedScore = useCountUp(0, atsScore);
  const gaugeOffset = CIRCUMFERENCE * (1 - displayedScore / 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6 bg-surface rounded-card p-6 flex-wrap">
        <div className="relative w-[112px] h-[112px] shrink-0">
          <svg width="112" height="112" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" className="stroke-chip-neutral-bg" strokeWidth="8" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              className="stroke-accent"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={gaugeOffset}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[27px] font-medium text-text-primary">{displayedScore}</div>
            <div className="text-[11px] text-text-secondary">/ 100</div>
          </div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="text-[11px] tracking-wide text-accent uppercase mb-[5px]">ATS alignment</div>
          <div className="text-sm text-text-secondary leading-relaxed">{suggestions.headline}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-surface rounded-lg p-4">
          <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Matched keywords</div>
          <div className="flex flex-wrap gap-[6px]">
            {matchedKeywords.map((kw) => (
              <span key={kw} className="text-[11px] px-[10px] py-[3px] rounded-md bg-accent-surface text-accent-surface-text">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Missing keywords</div>
          <div className="flex flex-wrap gap-[6px]">
            {missingKeywords.map((kw) => (
              <span key={kw} className="text-[11px] px-[10px] py-[3px] rounded-md bg-chip-neutral-bg text-chip-neutral-text">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Suggested improvements</div>
        <div className="flex flex-col gap-[9px]">
          {suggestions.bullets.map((bullet, i) => (
            <div key={i} className="flex gap-[9px] text-[13.5px] text-text-secondary leading-relaxed">
              <span className="text-accent shrink-0">—</span>
              <span>{bullet}</span>
            </div>
          ))}
        </div>
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
        className="w-full flex items-center justify-center gap-[9px] px-4 py-3 border border-accent rounded-lg bg-transparent text-accent text-[15px] font-medium disabled:opacity-50 cursor-pointer"
      >
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
          <path d="M7 1l1.2 3.8L12 6l-3.8 1.2L7 11l-1.2-3.8L2 6l3.8-1.2L7 1z" stroke="currentColor" strokeWidth="1" />
        </svg>
        {optimizing ? "Optimizing..." : "Optimize this resume"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/ScoringView.tsx
git commit -m "feat: restyle ScoringView with animated gauge and redesign tokens"
```

---

### Task 3: Create `TemplatePreviewModal`

**Files:**
- Create: `components/resume/TemplatePreviewModal.tsx`

**Interfaces:**
- Produces: `export function TemplatePreviewModal({ templateName, onClose, onUseTemplate }: { templateName: string; onClose: () => void; onUseTemplate: () => void }): JSX.Element` — consumed by Task 4 (`TemplateSelector`).

- [ ] **Step 1: Create `components/resume/TemplatePreviewModal.tsx`**

```tsx
"use client";

interface TemplatePreviewModalProps {
  templateName: string;
  onClose: () => void;
  onUseTemplate: () => void;
}

export function TemplatePreviewModal({ templateName, onClose, onUseTemplate }: TemplatePreviewModalProps) {
  return (
    <div onClick={onClose} className="fixed inset-0 flex items-center justify-center p-6 bg-black/50 z-50">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] max-h-[90vh] overflow-auto flex flex-col gap-[14px] p-[18px] rounded-card bg-surface shadow-[0_0_0_1px_var(--color-border-hairline),0_16px_40px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-medium text-text-primary">{templateName} template preview</div>
          <button
            type="button"
            onClick={onClose}
            className="w-[30px] h-[30px] rounded-lg border border-border-hairline bg-transparent text-text-primary text-[15px] leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="rounded-lg bg-surface-alt border border-border-hairline flex flex-col items-center justify-center gap-2 py-16 px-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="2" width="14" height="16" rx="2" className="stroke-text-secondary" strokeWidth="1.5" />
            <path d="M6.5 7h7M6.5 10.5h7M6.5 14h4" className="stroke-text-secondary" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-text-secondary">Preview coming soon</p>
        </div>

        <button
          type="button"
          onClick={() => {
            onUseTemplate();
            onClose();
          }}
          className="self-end flex items-center gap-[7px] px-4 py-2 border border-accent rounded-lg bg-transparent text-accent text-[13.5px] font-medium cursor-pointer"
        >
          Use this template
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

Expected: build succeeds (not consumed yet).

- [ ] **Step 3: Commit**

```bash
git add components/resume/TemplatePreviewModal.tsx
git commit -m "feat: add TemplatePreviewModal with placeholder preview content"
```

---

### Task 4: Restyle `TemplateSelector` and wire in the preview modal

**Files:**
- Modify: `components/resume/TemplateSelector.tsx`

**Interfaces:**
- Consumes: `TemplatePreviewModal` from `@/components/resume/TemplatePreviewModal` (Task 3).
- Produces: same `TemplateSelectorProps` as today, unchanged — consumed by `ResultView` (Task 5).

- [ ] **Step 1: Replace the contents of `components/resume/TemplateSelector.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { authFetch } from "@/lib/auth/authFetch";
import { TemplatePreviewModal } from "@/components/resume/TemplatePreviewModal";

interface TemplateOption {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
}

interface TemplateSelectorProps {
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
}

function ModernPreview() {
  return (
    <svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="240" height="120" fill="white" />
      <rect x="0" y="0" width="4" height="120" fill="#2563EB" />
      <text x="14" y="18" fontSize="9" fontWeight="bold" fill="#1a1a1a" fontFamily="system-ui,sans-serif">
        Alex Johnson
      </text>
      <text x="14" y="27" fontSize="5" fill="#6B7280" fontFamily="system-ui,sans-serif">
        alex@email.com · San Francisco, CA
      </text>
      <line x1="14" y1="33" x2="226" y2="33" stroke="#e2e8f0" strokeWidth="0.5" />
      <text x="14" y="42" fontSize="5.5" fontWeight="bold" fill="#2563EB" letterSpacing="0.8" fontFamily="system-ui,sans-serif">
        EXPERIENCE
      </text>
      <text x="14" y="51" fontSize="5.5" fontWeight="bold" fill="#1a1a1a" fontFamily="system-ui,sans-serif">
        Senior Software Engineer
      </text>
      <text x="14" y="58" fontSize="4.5" fill="#6B7280" fontFamily="system-ui,sans-serif">
        Acme Corp · 2021–Present
      </text>
      <rect x="14" y="62" width="60" height="2" rx="1" fill="#e2e8f0" />
      <rect x="14" y="66" width="80" height="2" rx="1" fill="#e2e8f0" />
      <rect x="14" y="70" width="50" height="2" rx="1" fill="#e2e8f0" />
      <text x="14" y="83" fontSize="5.5" fontWeight="bold" fill="#2563EB" letterSpacing="0.8" fontFamily="system-ui,sans-serif">
        SKILLS
      </text>
      <rect x="14" y="87" width="30" height="9" rx="3.5" fill="#EFF6FF" />
      <text x="29" y="93.5" fontSize="4" fill="#2563EB" textAnchor="middle" fontFamily="system-ui,sans-serif">
        Python
      </text>
      <rect x="48" y="87" width="28" height="9" rx="3.5" fill="#EFF6FF" />
      <text x="62" y="93.5" fontSize="4" fill="#2563EB" textAnchor="middle" fontFamily="system-ui,sans-serif">
        React
      </text>
      <rect x="80" y="87" width="30" height="9" rx="3.5" fill="#EFF6FF" />
      <text x="95" y="93.5" fontSize="4" fill="#2563EB" textAnchor="middle" fontFamily="system-ui,sans-serif">
        Docker
      </text>
      <rect x="114" y="87" width="24" height="9" rx="3.5" fill="#EFF6FF" />
      <text x="126" y="93.5" fontSize="4" fill="#2563EB" textAnchor="middle" fontFamily="system-ui,sans-serif">
        AWS
      </text>
    </svg>
  );
}

function MinimalPreview() {
  return (
    <svg viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width="240" height="120" fill="#fafaf9" />
      <text x="120" y="16" fontSize="10" fontWeight="bold" fill="#1a1a1a" fontFamily="Georgia,serif" textAnchor="middle">
        Alex Johnson
      </text>
      <text x="120" y="24" fontSize="4.5" fill="#555" textAnchor="middle" fontFamily="system-ui,sans-serif">
        alex@email.com · San Francisco, CA
      </text>
      <line x1="20" y1="29" x2="220" y2="29" stroke="#1a1a1a" strokeWidth="0.5" />
      <line x1="20" y1="38" x2="220" y2="38" stroke="#1a1a1a" strokeWidth="0.5" />
      <text x="120" y="36" fontSize="5.5" fontWeight="bold" fontFamily="Georgia,serif" textAnchor="middle" fill="#1a1a1a">
        EXPERIENCE
      </text>
      <text x="20" y="48" fontSize="5.5" fontWeight="bold" fontFamily="system-ui,sans-serif" fill="#1a1a1a">
        Senior Software Engineer
      </text>
      <text x="220" y="48" fontSize="4.5" fontFamily="system-ui,sans-serif" textAnchor="end" fill="#555">
        2021–Present
      </text>
      <rect x="20" y="52" width="60" height="2" rx="1" fill="#d0d0d0" />
      <rect x="20" y="56" width="80" height="2" rx="1" fill="#d0d0d0" />
      <rect x="20" y="60" width="50" height="2" rx="1" fill="#d0d0d0" />
      <line x1="20" y1="72" x2="220" y2="72" stroke="#1a1a1a" strokeWidth="0.5" />
      <line x1="20" y1="80" x2="220" y2="80" stroke="#1a1a1a" strokeWidth="0.5" />
      <text x="120" y="78" fontSize="5.5" fontWeight="bold" fontFamily="Georgia,serif" textAnchor="middle" fill="#1a1a1a">
        SKILLS
      </text>
      <text x="20" y="90" fontSize="4.5" fill="#1a1a1a" fontFamily="system-ui,sans-serif">
        Python, React, Docker, AWS, TypeScript
      </text>
    </svg>
  );
}

const PREVIEWS: Record<string, React.ComponentType> = {
  modern: ModernPreview,
  minimal: MinimalPreview,
};

export function TemplateSelector({ selectedTemplateId, onSelect }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/api/templates")
      .then((res) => res.json())
      .then((data: TemplateOption[]) => {
        setTemplates(data);
      })
      .catch(() => {
        setTemplates([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-sm text-text-secondary">Loading templates...</p>;
  }

  const previewTemplate = templates.find((t) => t.id === previewTemplateId) ?? null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {templates.map((template) => {
          const isSelected = template.id === selectedTemplateId;
          const Preview = PREVIEWS[template.id];
          return (
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(template.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(template.id);
                }
              }}
              className={`relative cursor-pointer rounded-lg p-[11px] bg-surface ${
                isSelected ? "shadow-[0_0_0_2px_var(--color-accent)]" : "shadow-[0_0_0_1px_var(--color-border-hairline)]"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 w-[18px] h-[18px] rounded-full bg-accent flex items-center justify-center z-10">
                  <IconCheck size={10} className="text-bg" />
                </div>
              )}
              <div className="h-20 sm:h-28 rounded-md overflow-hidden bg-surface-alt mb-[10px]">
                {Preview ? <Preview /> : null}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[13px] font-medium text-text-primary">{template.name}</div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewTemplateId(template.id);
                  }}
                  className="text-[11.5px] text-accent bg-transparent border-none cursor-pointer shrink-0"
                >
                  Preview
                </button>
              </div>
              <p className="text-[11.5px] text-text-secondary leading-tight mt-0.5">{template.description}</p>
            </div>
          );
        })}
      </div>

      {previewTemplate && (
        <TemplatePreviewModal
          templateName={previewTemplate.name}
          onClose={() => setPreviewTemplateId(null)}
          onUseTemplate={() => onSelect(previewTemplate.id)}
        />
      )}
    </>
  );
}
```

Note: `ModernPreview`/`MinimalPreview`/`PREVIEWS` above are transcribed byte-for-byte from the current file — do not alter them, per the Global Constraints.

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Navigate to an optimized application's result view, e.g. `http://localhost:3000/applications/<id>` for an application with `resumeData` set (or optimize one via the flow).
2. **Verify:** template cards render with the new tokens, selected card has the accent ring + checkmark badge.
3. Click "Preview" on a card.
4. **Verify:** modal opens centered on screen, shows the placeholder "Preview coming soon" box, does **not** change the selected template.
5. Click the backdrop (outside the dialog).
6. **Verify:** modal closes, selection unchanged.
7. Open the modal again, click "Use this template".
8. **Verify:** that template becomes selected (ring/badge move to it) and the modal closes.
9. Click the `×` button — confirm it also closes without changing selection.

- [ ] **Step 4: Commit**

```bash
git add components/resume/TemplateSelector.tsx
git commit -m "feat: restyle TemplateSelector and wire in the preview modal"
```

---

### Task 5: Restyle `ResultView`

**Files:**
- Modify: `components/ResultView.tsx`

**Interfaces:**
- Consumes: `useCountUp` from `@/lib/hooks/useCountUp` (Task 1); restyled `TemplateSelector` (Task 4, same props).
- Produces: same `ResultViewProps` as today, unchanged — consumed by `app/applications/[id]/page.tsx` (Phase C+D, not touched by this task).

- [ ] **Step 1: Replace the contents of `components/ResultView.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { ResumeData } from "@/types/resume.types";
import { TemplateSelector } from "@/components/resume/TemplateSelector";
import { authFetch } from "@/lib/auth/authFetch";
import { useCountUp } from "@/lib/hooks/useCountUp";

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

const CIRCUMFERENCE = 276.5;

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

  const normalize = (kw: string) => kw.trim().toLowerCase();
  const previousMissingNormalized = previousMissingKeywords.map(normalize);
  const keywordsAdded = matchedKeywords.filter((kw) => previousMissingNormalized.includes(normalize(kw)));

  const displayedAfter = useCountUp(previousAtsScore, atsScore);
  const beforeOffset = CIRCUMFERENCE * (1 - previousAtsScore / 100);
  const afterOffset = CIRCUMFERENCE * (1 - displayedAfter / 100);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await authFetch("/api/resume/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeData, templateId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(typeof err.error === "string" ? err.error : "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-start gap-[26px] bg-surface rounded-card p-6 flex-wrap">
        <div className="text-center">
          <div className="relative w-24 h-24">
            <svg width="96" height="96" viewBox="0 0 104 104">
              <circle cx="52" cy="52" r="44" fill="none" className="stroke-chip-neutral-bg" strokeWidth="7" />
              <circle
                cx="52"
                cy="52"
                r="44"
                fill="none"
                stroke="#75798c"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={beforeOffset}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[21px] font-medium text-text-secondary">{previousAtsScore}</div>
            </div>
          </div>
          <div className="text-[11px] tracking-wide text-text-secondary uppercase mt-2">Before</div>
        </div>

        <svg width="20" height="20" viewBox="0 0 22 22" fill="none" className="shrink-0">
          <path d="M4 11h14M13 5l6 6-6 6" className="stroke-text-secondary" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="text-center">
          <div className="relative w-24 h-24">
            <svg width="96" height="96" viewBox="0 0 104 104">
              <circle cx="52" cy="52" r="44" fill="none" className="stroke-chip-neutral-bg" strokeWidth="7" />
              <circle
                cx="52"
                cy="52"
                r="44"
                fill="none"
                className="stroke-accent"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={afterOffset}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[21px] font-medium text-text-primary">{displayedAfter}</div>
            </div>
          </div>
          <div className="text-[11px] tracking-wide text-accent uppercase mt-2">After</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-surface rounded-lg p-4">
          <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Keywords added</div>
          <div className="flex flex-wrap gap-[6px]">
            {keywordsAdded.map((kw) => (
              <span key={kw} className="text-[11px] px-[10px] py-[3px] rounded-md bg-accent-surface text-accent-surface-text">
                {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-surface rounded-lg p-4">
          <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">Still missing</div>
          <div className="flex flex-wrap gap-[6px]">
            {missingKeywords.map((kw) => (
              <span key={kw} className="text-[11px] px-[10px] py-[3px] rounded-md bg-chip-neutral-bg text-chip-neutral-text">
                {kw}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg p-[19px]">
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-[10px]">What changed</div>
        <div className="flex flex-col gap-[9px]">
          {summaryOfChanges.bullets.map((bullet, i) => (
            <div key={i} className="flex gap-[9px] text-[13.5px] text-text-secondary leading-relaxed">
              <svg width="13" height="13" viewBox="0 0 11 11" fill="none" className="shrink-0 mt-[3px] stroke-accent">
                <path d="M2 5.5l2.3 2.3L9 3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10.5px] tracking-wide text-text-secondary uppercase mb-3">Choose a template</div>
        <TemplateSelector selectedTemplateId={templateId} onSelect={setTemplateId} />
      </div>

      <div className="flex flex-col gap-[9px]">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-[9px] px-4 py-3 border border-accent rounded-lg bg-transparent text-accent text-[15px] font-medium disabled:opacity-50 cursor-pointer"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 1v8M4 6l3.5 3.5L11 6M2.5 12h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {downloading ? "Generating PDF..." : "Download PDF"}
        </button>
        {downloadError && <p className="text-sm text-red-600 dark:text-red-400">{downloadError}</p>}
        <button
          type="button"
          onClick={onRestart}
          className="px-4 py-[11px] border border-border-hairline rounded-lg bg-transparent text-text-primary text-sm cursor-pointer"
        >
          Back to dashboard
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

Expected: build succeeds.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Navigate to an already-optimized application's detail page.
2. **Verify:** before/after gauge pair renders; the "after" number counts up from the previous score to the current score on mount (ease-out, ~950ms); the "before" number is static.
3. **Verify:** keyword chips, "what changed" list, template selector (with working Preview modal from Task 4), and the download button all render with the new tokens.
4. Click "Download PDF" — confirm the label changes to "Generating PDF..." while the request is in flight and a real PDF downloads.
5. Click "Back to dashboard" — confirm it navigates to `/` (via the unchanged `onRestart`/`router.push("/")` from the parent page).
6. Toggle dark/light — confirm both gauges, chips, and the modal render correctly in both themes.
7. Also revisit a **scored-only** (not yet optimized) application and confirm `ScoringView`'s single gauge counts up from 0 correctly, independent of this task's changes to `ResultView`.

- [ ] **Step 4: Commit**

```bash
git add components/ResultView.tsx
git commit -m "feat: restyle ResultView with animated before/after gauges"
```
