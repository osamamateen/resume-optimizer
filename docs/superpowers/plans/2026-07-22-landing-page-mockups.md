# Landing Page Mockup Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the landing page's four "Product preview" placeholder frames (1 in `Hero.tsx`, 3 in `Solution.tsx`) with static mockup components built from the app's real UI patterns.

**Architecture:** Four new no-prop presentational components under `components/landing/mockups/`, each recreating a real app screen (dashboard list, ATS gauge, keyword chips, before/after gauges) at a smaller scale with fixed illustrative data. `Hero.tsx` and `Solution.tsx` each swap their placeholder `<span>` for the matching mockup component inside their existing frame div.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, plain inline SVG (no icon library needed — matches the SVG-gauge pattern already used in `ScoringView.tsx`/`ResultView.tsx`).

## Global Constraints

- No new dependencies.
- Every new file starts with `"use client"` — matches the existing `components/` convention.
- Every class/SVG technique used must already exist in the codebase: reuse `stroke-accent`/`stroke-chip-neutral-bg`/`strokeDasharray`/`strokeDashoffset` gauge math from `components/ScoringView.tsx` and `components/ResultView.tsx`, and the `bg-accent-surface`/`text-accent-surface-text` vs. `bg-chip-neutral-bg`/`text-chip-neutral-text` chip pair from the same files and `app/page.tsx`'s dashboard list. No new CSS custom properties.
- Mockups are static: no props, no state, no fetching, no interactivity — fixed illustrative numbers/strings only.
- The two frame divs being modified (`Hero.tsx`'s `aspect-video` frame, `Solution.tsx`'s `aspect-[4/3]` frame) gain `overflow-hidden` so mockup content clips cleanly to the existing rounded corners; no other change to those frames' sizing/border/shadow classes.
- This repo has no automated test runner — verification is `npm run build` (type-check) for standalone components and a manual/headless-browser check for the two wiring tasks.

---

### Task 1: Create `HeroMockup` component

**Files:**
- Create: `components/landing/mockups/HeroMockup.tsx`

**Interfaces:**
- Consumes: nothing new (plain React/Tailwind).
- Produces: `export function HeroMockup(): JSX.Element` (no props) — consumed by Task 5's `Hero.tsx`.

- [ ] **Step 1: Create `components/landing/mockups/HeroMockup.tsx`**

```tsx
"use client";

export function HeroMockup() {
  return (
    <div className="w-full h-full flex flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between">
        <div className="text-[15px] font-medium tracking-[-0.01em] text-text-primary">Your applications</div>
        <div className="text-[11px] px-3 py-[6px] border border-accent rounded-lg text-accent font-medium whitespace-nowrap">
          + New application
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bg rounded-lg px-3 py-[10px]">
          <div className="text-[9px] tracking-wide text-text-secondary uppercase">Applications</div>
          <div className="text-[18px] font-medium mt-1 text-text-primary">12</div>
        </div>
        <div className="bg-bg rounded-lg px-3 py-[10px]">
          <div className="text-[9px] tracking-wide text-text-secondary uppercase">Average score</div>
          <div className="text-[18px] font-medium mt-1 text-text-primary">
            84<span className="text-[10px] text-text-secondary">/100</span>
          </div>
        </div>
        <div className="bg-bg rounded-lg px-3 py-[10px]">
          <div className="text-[9px] tracking-wide text-text-secondary uppercase">Optimized</div>
          <div className="text-[18px] font-medium mt-1 text-text-primary">
            9<span className="text-[10px] text-text-secondary"> / 12</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="bg-bg rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-medium text-text-primary whitespace-nowrap">Senior Product Manager</span>
            <span className="text-[11px] text-text-secondary whitespace-nowrap">· Acme Inc</span>
            <span className="text-[9px] tracking-wide uppercase px-2 py-[2px] rounded-md bg-accent-surface text-accent-surface-text whitespace-nowrap">
              Optimized
            </span>
          </div>
          <div className="text-[15px] font-medium text-text-primary shrink-0">
            92<span className="text-[10px] text-text-secondary">/100</span>
          </div>
        </div>
        <div className="bg-bg rounded-lg px-4 py-3 flex items-center justify-between opacity-60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-medium text-text-primary whitespace-nowrap">Growth Lead</span>
            <span className="text-[11px] text-text-secondary whitespace-nowrap">· Northwind</span>
            <span className="text-[9px] tracking-wide uppercase px-2 py-[2px] rounded-md bg-chip-neutral-bg text-chip-neutral-text whitespace-nowrap">
              Scored
            </span>
          </div>
          <div className="text-[15px] font-medium text-text-primary shrink-0">
            78<span className="text-[10px] text-text-secondary">/100</span>
          </div>
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

Expected: build succeeds with no type errors (component isn't imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add components/landing/mockups/HeroMockup.tsx
git commit -m "feat: add HeroMockup component"
```

---

### Task 2: Create `ScoreMockup` component

**Files:**
- Create: `components/landing/mockups/ScoreMockup.tsx`

**Interfaces:**
- Consumes: nothing new (plain React/SVG).
- Produces: `export function ScoreMockup(): JSX.Element` (no props) — consumed by Task 5's `Solution.tsx`.

- [ ] **Step 1: Create `components/landing/mockups/ScoreMockup.tsx`**

```tsx
"use client";

const CIRCUMFERENCE = 326.7;
const SCORE = 74;
const OFFSET = CIRCUMFERENCE * (1 - SCORE / 100);

export function ScoreMockup() {
  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="relative w-[104px] h-[104px]">
        <svg width="104" height="104" viewBox="0 0 120 120">
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
            strokeDashoffset={OFFSET}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[24px] font-medium text-text-primary">{SCORE}</div>
          <div className="text-[10px] text-text-secondary">/ 100</div>
        </div>
      </div>
      <div className="text-center max-w-[220px]">
        <div className="text-[10px] tracking-wide text-accent uppercase mb-1">ATS alignment</div>
        <div className="text-[12.5px] text-text-secondary leading-relaxed">Strong match — a few keyword gaps remain.</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/mockups/ScoreMockup.tsx
git commit -m "feat: add ScoreMockup component"
```

---

### Task 3: Create `KeywordsMockup` component

**Files:**
- Create: `components/landing/mockups/KeywordsMockup.tsx`

**Interfaces:**
- Consumes: nothing new (plain React).
- Produces: `export function KeywordsMockup(): JSX.Element` (no props) — consumed by Task 5's `Solution.tsx`.

- [ ] **Step 1: Create `components/landing/mockups/KeywordsMockup.tsx`**

```tsx
"use client";

const matched = ["Roadmapping", "Cross-functional", "Agile"];
const missing = ["SQL", "A/B testing", "Stakeholder mgmt"];

export function KeywordsMockup() {
  return (
    <div className="flex flex-col gap-4 p-6 w-full max-w-[280px]">
      <div>
        <div className="text-[9px] tracking-wide text-text-secondary uppercase mb-2">Matched keywords</div>
        <div className="flex flex-wrap gap-[6px]">
          {matched.map((kw) => (
            <span key={kw} className="text-[10.5px] px-[9px] py-[3px] rounded-md bg-accent-surface text-accent-surface-text">
              {kw}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[9px] tracking-wide text-text-secondary uppercase mb-2">Missing keywords</div>
        <div className="flex flex-wrap gap-[6px]">
          {missing.map((kw) => (
            <span key={kw} className="text-[10.5px] px-[9px] py-[3px] rounded-md bg-chip-neutral-bg text-chip-neutral-text">
              {kw}
            </span>
          ))}
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

Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/mockups/KeywordsMockup.tsx
git commit -m "feat: add KeywordsMockup component"
```

---

### Task 4: Create `RewriteMockup` component

**Files:**
- Create: `components/landing/mockups/RewriteMockup.tsx`

**Interfaces:**
- Consumes: nothing new (plain React/SVG).
- Produces: `export function RewriteMockup(): JSX.Element` (no props) — consumed by Task 5's `Solution.tsx`.

- [ ] **Step 1: Create `components/landing/mockups/RewriteMockup.tsx`**

```tsx
"use client";

const CIRCUMFERENCE = 276.5;
const BEFORE = 68;
const AFTER = 91;
const BEFORE_OFFSET = CIRCUMFERENCE * (1 - BEFORE / 100);
const AFTER_OFFSET = CIRCUMFERENCE * (1 - AFTER / 100);

export function RewriteMockup() {
  return (
    <div className="flex flex-col items-center gap-4 p-5">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="relative w-[76px] h-[76px]">
            <svg width="76" height="76" viewBox="0 0 104 104">
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
                strokeDashoffset={BEFORE_OFFSET}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-text-secondary">
              {BEFORE}
            </div>
          </div>
          <div className="text-[9px] tracking-wide text-text-secondary uppercase mt-[6px]">Before</div>
        </div>

        <svg width="16" height="16" viewBox="0 0 22 22" fill="none" className="shrink-0">
          <path
            d="M4 11h14M13 5l6 6-6 6"
            className="stroke-text-secondary"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="text-center">
          <div className="relative w-[76px] h-[76px]">
            <svg width="76" height="76" viewBox="0 0 104 104">
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
                strokeDashoffset={AFTER_OFFSET}
                transform="rotate(-90 52 52)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-text-primary">
              {AFTER}
            </div>
          </div>
          <div className="text-[9px] tracking-wide text-accent uppercase mt-[6px]">After</div>
        </div>
      </div>

      <div className="flex items-center gap-[7px] px-4 py-[9px] border border-accent rounded-lg text-accent text-[12px] font-medium whitespace-nowrap">
        <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
          <path
            d="M7.5 1v8M4 6l3.5 3.5L11 6M2.5 12h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Download PDF
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/mockups/RewriteMockup.tsx
git commit -m "feat: add RewriteMockup component"
```

---

### Task 5: Wire the mockups into `Hero.tsx` and `Solution.tsx`

**Files:**
- Modify: `components/landing/Hero.tsx`
- Modify: `components/landing/Solution.tsx`

**Interfaces:**
- Consumes: `HeroMockup` (Task 1), `ScoreMockup` (Task 2), `KeywordsMockup` (Task 3), `RewriteMockup` (Task 4) — all no-prop components.
- Produces: no new exports — `Hero` and `Solution` keep their existing `export function` signatures.

- [ ] **Step 1: Replace the placeholder frame in `components/landing/Hero.tsx`**

Add the import alongside the existing `next/link` import:

```tsx
import { HeroMockup } from "@/components/landing/mockups/HeroMockup";
```

Replace the frame `<div>` at the bottom of the component:

```tsx
      <div className="mt-[clamp(48px,8vw,72px)] rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-video max-w-[860px] mx-auto flex items-center justify-center">
        <span className="text-[13px] tracking-wide uppercase text-text-secondary">Product preview</span>
      </div>
```

with:

```tsx
      <div className="mt-[clamp(48px,8vw,72px)] rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-video max-w-[860px] mx-auto overflow-hidden">
        <HeroMockup />
      </div>
```

- [ ] **Step 2: Replace the placeholder frames in `components/landing/Solution.tsx`**

Replace the full file contents:

```tsx
"use client";

import type { ReactNode } from "react";
import { ScoreMockup } from "@/components/landing/mockups/ScoreMockup";
import { KeywordsMockup } from "@/components/landing/mockups/KeywordsMockup";
import { RewriteMockup } from "@/components/landing/mockups/RewriteMockup";

interface SolutionRow {
  title: string;
  description: string;
  visual: ReactNode;
}

const rows: SolutionRow[] = [
  {
    title: "Score against the job description",
    description:
      "Your original resume is scored first, unmodified — so the before-and-after comparison always stays honest.",
    visual: <ScoreMockup />,
  },
  {
    title: "See what's missing",
    description: "ATS keyword gaps are surfaced explicitly, not buried inside a single opaque number.",
    visual: <KeywordsMockup />,
  },
  {
    title: "Get a tailored rewrite",
    description:
      "One click re-runs the optimization against your original resume, then download it as a PDF or DOCX in your chosen template.",
    visual: <RewriteMockup />,
  },
];

export function Solution() {
  return (
    <section className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] py-[clamp(56px,9vw,88px)] flex flex-col gap-[clamp(48px,8vw,72px)]">
      {rows.map((row, i) => (
        <div
          key={row.title}
          className={`flex flex-col md:flex-row items-center gap-8 md:gap-14 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}
        >
          <div className="flex-1 rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-[4/3] w-full flex items-center justify-center overflow-hidden">
            {row.visual}
          </div>
          <div className="flex-1 flex flex-col gap-3">
            <h3 className="text-[24px] font-medium tracking-[-0.015em]">{row.title}</h3>
            <p className="text-[15px] text-text-secondary leading-relaxed max-w-[440px]">{row.description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Open `http://localhost:3000/` in a private/incognito window. **Verify:** the hero's preview frame shows the dashboard mockup (stats row + "Senior Product Manager · Acme Inc" Optimized row + dimmed "Growth Lead · Northwind" Scored row) instead of the "Product preview" label.
2. Scroll to the Solution section. **Verify:** row 1 shows the 74/100 circular gauge, row 2 shows matched (accent) vs. missing (neutral) keyword chips, row 3 shows the 68→91 before/after gauges with a "Download PDF" button visual.
3. Toggle light/dark theme. **Verify:** all four mockups render correctly in both themes (gauge colors, chip colors, text contrast).
4. Resize to mobile width. **Verify:** all four mockups stay legible and don't overflow their rounded frames (check `overflow-hidden` is clipping correctly, not cutting off critical content).
5. Check the browser console. **Verify:** no new errors introduced by the mockups.

- [ ] **Step 4: Commit**

```bash
git add components/landing/Hero.tsx components/landing/Solution.tsx
git commit -m "feat: wire mockup screens into Hero and Solution placeholder frames"
```
