# Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, Stripe/Linear-caliber marketing landing page (Hero, Solution, Features, How It Works, Footer) and show it at `/` for anonymous visitors, leaving the existing authenticated dashboard untouched.

**Architecture:** Six new presentational components under `components/landing/` (`LandingHeader`, `Hero`, `Solution`, `Features`, `HowItWorks`, `LandingFooter`), composed by a new `LandingPage` component. `app/page.tsx` renders `<LandingPage />` when `ready && !accessToken` instead of redirecting to `/login`, and keeps its existing dashboard render unchanged when `ready && accessToken`. No new API routes, no new dependencies, no data fetching in the landing components.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4, `@tabler/icons-react` (already a dependency — `IconGauge`, `IconSearch`, `IconWand`, `IconFileUpload`, `IconTemplate`, `IconArrowsExchange` all confirmed to exist in the installed version).

## Global Constraints

- No new dependencies.
- Every new file under `components/landing/` starts with `"use client"` — matches the existing convention (every file in `components/` today has this directive, even purely presentational ones like `AppHeader.tsx`).
- Tailwind utility classes only — no inline `style={}` (existing convention; use arbitrary-value classes like `shadow-[var(--card-shadow)]` instead).
- Reuse only existing design tokens from `app/globals.css` / `@theme inline`: `bg-bg`, `text-text-primary`, `text-text-secondary`, `bg-surface`, `bg-accent-surface`, `text-accent-surface-text`, `border-border-hairline`, `text-accent`, `border-accent`, `bg-accent`, `rounded-card`, `shadow-[var(--card-shadow)]`. No new CSS custom properties.
- Exactly one solid-fill button on the whole page: the Hero's primary "Get started free" CTA (`bg-accent text-bg`, precedented by the "done" step badge in `components/AppHeader.tsx:31`). Every other button/link (header "Sign up", footer links, secondary CTAs) uses the app's existing outlined-accent convention (`border-accent bg-transparent text-accent`, e.g. the dashboard's "New application" button).
- No pricing, testimonials, or FAQ sections — explicitly deferred (per spec `docs/superpowers/specs/2026-07-22-landing-page-design.md`).
- Hero and Solution "product preview" areas use an identical placeholder treatment: `rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)]` frame containing only the centered label "Product preview" — no other decoration, so a real screenshot can drop in later without a layout change.
- Raw apostrophes must never appear directly inside JSX text content (trips `react/no-unescaped-entities` under this repo's `eslint-config-next` setup) — write such strings as a JS expression (`{"what's missing"}`) instead. Apostrophes inside plain `.ts`/`.tsx` string literals referenced via `{variable}` are unaffected and fine as-is.
- This repo has no automated test runner — verification is `npm run build` (type-check) for standalone components and manual browser checks via `npm run dev` for the integration task.

---

### Task 1: Create `LandingHeader` component

**Files:**
- Create: `components/landing/LandingHeader.tsx`

**Interfaces:**
- Consumes: `Link` (`next/link`), `ThemeToggle` (`@/components/ThemeToggle`, existing, no prop changes).
- Produces: `export function LandingHeader(): JSX.Element` — consumed by Task 7's `LandingPage.tsx`.

- [ ] **Step 1: Create `components/landing/LandingHeader.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-10 bg-bg border-b border-border-hairline">
      <div className="max-w-[1100px] mx-auto flex items-center gap-[17px] px-[clamp(24px,6vw,64px)] py-4">
        <Link href="/" className="text-[18px] font-medium tracking-[-0.015em] mr-auto">
          Resume<span className="text-accent">Tailor</span>
        </Link>
        <Link href="/login" className="text-[13.5px] text-text-secondary">
          Log in
        </Link>
        <Link
          href="/signup"
          className="px-4 py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium whitespace-nowrap"
        >
          Sign up
        </Link>
        <ThemeToggle />
      </div>
    </header>
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
git add components/landing/LandingHeader.tsx
git commit -m "feat: add LandingHeader component"
```

---

### Task 2: Create `Hero` component

**Files:**
- Create: `components/landing/Hero.tsx`

**Interfaces:**
- Consumes: `Link` (`next/link`).
- Produces: `export function Hero(): JSX.Element` — consumed by Task 7's `LandingPage.tsx`.

- [ ] **Step 1: Create `components/landing/Hero.tsx`**

```tsx
"use client";

import Link from "next/link";

export function Hero() {
  return (
    <section className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] pt-[clamp(56px,10vw,96px)] pb-[clamp(48px,8vw,80px)]">
      <div className="flex flex-col items-center text-center gap-6">
        <span className="inline-flex items-center px-3 py-[6px] rounded-full bg-accent-surface text-accent-surface-text text-[12.5px] font-medium tracking-wide">
          AI-powered resume tailoring
        </span>
        <h1 className="text-[clamp(32px,5vw,52px)] font-medium tracking-[-0.02em] leading-[1.1] max-w-[720px]">
          Tailor your resume to every job, not just one
        </h1>
        <p className="text-[16px] text-text-secondary max-w-[560px] leading-relaxed">
          {"Score your resume against a job description, see exactly what's missing, and get a tailored rewrite — before you ever hit submit."}
        </p>
        <div className="flex items-center gap-4 flex-wrap justify-center mt-2">
          <Link href="/signup" className="px-6 py-[13px] rounded-lg bg-accent text-bg text-[14.5px] font-medium">
            Get started free
          </Link>
          <Link href="/login" className="text-[14.5px] text-text-secondary">
            Log in →
          </Link>
        </div>
      </div>

      <div className="mt-[clamp(48px,8vw,72px)] rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-video max-w-[860px] mx-auto flex items-center justify-center">
        <span className="text-[13px] tracking-wide uppercase text-text-secondary">Product preview</span>
      </div>
    </section>
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
git add components/landing/Hero.tsx
git commit -m "feat: add Hero component"
```

---

### Task 3: Create `Solution` component

**Files:**
- Create: `components/landing/Solution.tsx`

**Interfaces:**
- Consumes: nothing new (plain React).
- Produces: `export function Solution(): JSX.Element` — consumed by Task 7's `LandingPage.tsx`.

- [ ] **Step 1: Create `components/landing/Solution.tsx`**

```tsx
"use client";

interface SolutionRow {
  title: string;
  description: string;
}

const rows: SolutionRow[] = [
  {
    title: "Score against the job description",
    description:
      "Your original resume is scored first, unmodified — so the before-and-after comparison always stays honest.",
  },
  {
    title: "See what's missing",
    description: "ATS keyword gaps are surfaced explicitly, not buried inside a single opaque number.",
  },
  {
    title: "Get a tailored rewrite",
    description:
      "One click re-runs the optimization against your original resume, then download it as a PDF or DOCX in your chosen template.",
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
          <div className="flex-1 rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-[4/3] w-full flex items-center justify-center">
            <span className="text-[13px] tracking-wide uppercase text-text-secondary">Product preview</span>
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

Note: `row.description` for "See what's missing" contains an apostrophe, but it's a plain `.tsx` string literal referenced via `{row.description}`, not raw JSX text — this does not trip `react/no-unescaped-entities`.

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/Solution.tsx
git commit -m "feat: add Solution component"
```

---

### Task 4: Create `Features` component

**Files:**
- Create: `components/landing/Features.tsx`

**Interfaces:**
- Consumes: `IconGauge`, `IconSearch`, `IconWand`, `IconFileUpload`, `IconTemplate`, `IconArrowsExchange`, and the `Icon` type (all from `@tabler/icons-react`, existing dependency).
- Produces: `export function Features(): JSX.Element` — consumed by Task 7's `LandingPage.tsx`.

- [ ] **Step 1: Create `components/landing/Features.tsx`**

```tsx
"use client";

import { IconGauge, IconSearch, IconWand, IconFileUpload, IconTemplate, IconArrowsExchange } from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";

interface Feature {
  icon: Icon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: IconGauge,
    title: "ATS Score Simulation",
    description: "See how an applicant tracking system would score your resume before you ever apply.",
  },
  {
    icon: IconSearch,
    title: "Keyword Gap Analysis",
    description: "Every keyword the job description mentions that your resume doesn't, laid out clearly.",
  },
  {
    icon: IconWand,
    title: "One-Click Tailored Rewrite",
    description: "Turn suggestions into a rewritten resume in a single click, no starting from scratch.",
  },
  {
    icon: IconFileUpload,
    title: "Master Resume",
    description: "Upload once, reuse it for every application — no re-uploading for each new role.",
  },
  {
    icon: IconTemplate,
    title: "Template Library",
    description: "Download your tailored resume as a polished PDF or DOCX, styled to match your target role.",
  },
  {
    icon: IconArrowsExchange,
    title: "Before/After Comparison",
    description: "Your original score is never overwritten, so you can always see exactly what improved.",
  },
];

export function Features() {
  return (
    <section className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] py-[clamp(56px,9vw,88px)]">
      <div className="text-center mb-[clamp(40px,6vw,56px)]">
        <h2 className="text-[clamp(26px,3.5vw,36px)] font-medium tracking-[-0.015em]">
          Everything you need to apply with confidence
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {features.map((feature) => {
          const FeatureIcon = feature.icon;
          return (
            <div
              key={feature.title}
              className="rounded-card border border-border-hairline bg-surface p-6 transition-all duration-150 hover:-translate-y-[3px] hover:shadow-[var(--card-shadow)]"
            >
              <div className="w-9 h-9 rounded-[10px] bg-accent-surface flex items-center justify-center mb-4">
                <FeatureIcon size={18} className="text-accent-surface-text" />
              </div>
              <h3 className="text-[15.5px] font-medium mb-[6px]">{feature.title}</h3>
              <p className="text-[13.5px] text-text-secondary leading-relaxed">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

Note: `feature.description` for "Keyword Gap Analysis" contains an apostrophe, but it's a plain string literal referenced via `{feature.description}`, not raw JSX text — fine as-is.

- [ ] **Step 2: Type-check**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/Features.tsx
git commit -m "feat: add Features component"
```

---

### Task 5: Create `HowItWorks` component

**Files:**
- Create: `components/landing/HowItWorks.tsx`

**Interfaces:**
- Consumes: nothing new (plain React).
- Produces: `export function HowItWorks(): JSX.Element` — consumed by Task 7's `LandingPage.tsx`.

- [ ] **Step 1: Create `components/landing/HowItWorks.tsx`**

```tsx
"use client";

interface Step {
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    title: "Upload your master resume",
    description: "Do it once — every future application reuses it automatically.",
  },
  {
    title: "Paste the job description",
    description: "Add the company, role, and posting text for the job you're applying to.",
  },
  {
    title: "Score, then optimize",
    description: "See your ATS score and keyword gaps first, then optimize and download when you're ready.",
  },
];

export function HowItWorks() {
  return (
    <section className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] py-[clamp(56px,9vw,88px)]">
      <div className="text-center mb-[clamp(40px,6vw,56px)]">
        <h2 className="text-[clamp(26px,3.5vw,36px)] font-medium tracking-[-0.015em]">How it works</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {steps.map((step, i) => (
          <div key={step.title} className="flex flex-col items-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent-surface flex items-center justify-center text-accent-surface-text text-[15px] font-medium">
              {i + 1}
            </div>
            <h3 className="text-[16px] font-medium">{step.title}</h3>
            <p className="text-[13.5px] text-text-secondary leading-relaxed max-w-[280px]">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
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
git add components/landing/HowItWorks.tsx
git commit -m "feat: add HowItWorks component"
```

---

### Task 6: Create `LandingFooter` component

**Files:**
- Create: `components/landing/LandingFooter.tsx`

**Interfaces:**
- Consumes: `Link` (`next/link`).
- Produces: `export function LandingFooter(): JSX.Element` — consumed by Task 7's `LandingPage.tsx`.

- [ ] **Step 1: Create `components/landing/LandingFooter.tsx`**

```tsx
"use client";

import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="border-t border-border-hairline">
      <div className="max-w-[1100px] mx-auto px-[clamp(24px,6vw,64px)] py-10 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="text-[15px] font-medium tracking-[-0.015em]">
            Resume<span className="text-accent">Tailor</span>
          </span>
          <span className="text-[12.5px] text-text-secondary">AI-powered resume tailoring for every application.</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-[13.5px] text-text-secondary">
            Log in
          </Link>
          <Link href="/signup" className="text-[13.5px] text-accent font-medium">
            Sign up
          </Link>
        </div>
      </div>
      <div className="text-center text-[12px] text-text-secondary pb-6">
        © {new Date().getFullYear()} ResumeTailor. All rights reserved.
      </div>
    </footer>
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
git add components/landing/LandingFooter.tsx
git commit -m "feat: add LandingFooter component"
```

---

### Task 7: Compose `LandingPage` and wire it into `app/page.tsx`

**Files:**
- Create: `components/landing/LandingPage.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `LandingHeader` (Task 1), `Hero` (Task 2), `Solution` (Task 3), `Features` (Task 4), `HowItWorks` (Task 5), `LandingFooter` (Task 6) — all no-prop components. In `app/page.tsx`: `useAuth()` (existing, `@/lib/auth/AuthContext`) for `{ accessToken, ready, logout }`.
- Produces: `export function LandingPage(): JSX.Element` (no props). `app/page.tsx` gains no new exports — it remains the `/` route's default export.

- [ ] **Step 1: Create `components/landing/LandingPage.tsx`**

```tsx
"use client";

import { LandingHeader } from "@/components/landing/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { Solution } from "@/components/landing/Solution";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <LandingHeader />
      <Hero />
      <Solution />
      <Features />
      <HowItWorks />
      <LandingFooter />
    </div>
  );
}
```

- [ ] **Step 2: Modify `app/page.tsx`**

Two changes to the existing file:

1. Add the import `import { LandingPage } from "@/components/landing/LandingPage";` alongside the other component imports.
2. Remove the redirect-to-login `useEffect` entirely (anonymous visitors now see the landing page instead of being redirected), and replace the `if (!ready || !accessToken) { return null; }` guard with a two-step guard that renders `<LandingPage />` for anonymous, ready users.

Replace the top of the file (imports through the guard, i.e. everything before `const apps = applications ?? [];`) with:

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
import { Skeleton } from "@/components/Skeleton";
import { LandingPage } from "@/components/landing/LandingPage";

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
    if (!accessToken) return;
    authFetch("/api/applications")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load applications");
        const data = await res.json();
        setApplications(data.applications);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load applications"));
  }, [accessToken]);

  if (!ready) {
    return null;
  }

  if (!accessToken) {
    return <LandingPage />;
  }
```

Everything from `const apps = applications ?? [];` through the end of the file (the dashboard's stats row, application list, skeletons, and empty state) stays exactly as it is today — no other lines change.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Open `http://localhost:3000/` in a private/incognito window (no stored session). **Verify:** the landing page renders — sticky header with wordmark + "Log in"/"Sign up"/theme toggle, hero with badge/headline/subhead/CTAs/preview frame, alternating Solution rows, 6-card Features grid, 3-step How It Works, footer. No redirect to `/login` occurs.
2. Toggle the theme via the header's theme toggle. **Verify:** every section (badge, cards, preview frames, buttons, footer) renders correctly in both light and dark mode — no unstyled or invisible text.
3. Resize the browser to a narrow (mobile) width. **Verify:** header stays usable, hero stacks vertically, Solution rows stack (image above text), Features grid collapses to 1 column, How It Works collapses to 1 column, footer stacks — no horizontal overflow/scrollbar anywhere on the page.
4. Hover over a Feature card on desktop. **Verify:** it lifts slightly with a deepened shadow, no color change, no jank.
5. Click the Hero's primary "Get started free" button. **Verify:** navigates to `/signup`.
6. Go back to `/`, click the Hero's secondary "Log in →" link (or the header's "Log in" link). **Verify:** navigates to `/login`.
7. Log in with an existing account (or sign up), then navigate back to `/`. **Verify:** the existing applications dashboard renders exactly as before (header with wordmark/Log out/theme toggle, master resume banner, stats row or empty state, application list) — the landing page does not appear for a logged-in session.
8. Log out from the dashboard. **Verify:** lands on `/login` (existing logout behavior, unchanged), and manually navigating back to `/` afterward shows the landing page again (not a redirect loop).

- [ ] **Step 4: Commit**

```bash
git add components/landing/LandingPage.tsx app/page.tsx
git commit -m "feat: show marketing landing page at / for anonymous visitors"
```
