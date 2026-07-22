# Landing page design

## Problem

`app/page.tsx` currently redirects every anonymous visitor straight to `/login` — there is no marketing page. The app needs a premium, Stripe/Linear/Vercel-caliber landing page for logged-out visitors at the root path, without touching the authenticated dashboard that already lives there.

## Scope

In scope: Hero, Solution, Features, How It Works, Footer sections, wired in as the anonymous-visitor view of `/`.

Out of scope (explicitly deferred, not part of this spec): Testimonials, Pricing, FAQ sections (no real content for them yet); real product screenshots (placeholder frames used instead, sized so a screenshot can drop in later without a layout change).

## Architecture

`app/page.tsx` currently does:

```tsx
if (!ready || !accessToken) {
  return null;
}
```

This becomes:

```tsx
if (!ready) {
  return null;
}
if (!accessToken) {
  return <LandingPage />;
}
```

The rest of `app/page.tsx` (the authenticated dashboard render) is unchanged. The landing page is fully static — no data fetching, no server state — so there is no additional data flow to design. `AuthProvider` already wraps the whole app in `app/layout.tsx`, so `useAuth()` continues to work unchanged for this check.

## Components

New directory: `components/landing/`

- **`LandingHeader.tsx`** — sticky header, hairline bottom border (`--border-hairline`), transparent background. Contents: logo wordmark ("Resume**Tailor**", accent-colored second word, matching the existing style in `app/login/page.tsx`), `ThemeToggle` (reused from `components/ThemeToggle.tsx`), a "Log in" link (`/login`), and a "Sign up" button (`/signup`, accent-bordered, matching the existing button style used elsewhere in the app).
- **`Hero.tsx`** — small accent-surface announcement badge ("AI-powered resume tailoring"), large headline, supporting subhead, primary CTA button (→ `/signup`) and secondary CTA link (→ `/login`), and a bordered/shadowed placeholder frame below/beside the copy labeled "Product preview" — sized and positioned for a future screenshot, no other decoration.
- **`Solution.tsx`** — 3 alternating rows (text left/visual right, then reversed, then repeat), each pairing a short heading + description with the same placeholder-frame treatment as the hero. Content follows the app's real score → gap → optimize flow (see Content below).
- **`Features.tsx`** — responsive grid (3 columns desktop, 1 column mobile) of 6 cards. Each card: `@tabler/icons-react` icon in a small accent-surface badge, title, one-line description. Hover: subtle `translateY(-2px)` + shadow deepen via `var(--card-shadow)`, transition only (no color/scale changes) — matches the "no flashy animations" brief.
- **`HowItWorks.tsx`** — 3 numbered steps, horizontal on desktop / stacked on mobile, each with a number badge, title, one-line description.
- **`LandingFooter.tsx`** — logo wordmark, one-line tagline, Log in / Sign up links, copyright line with current year.
- **`LandingPage.tsx`** — composes `LandingHeader`, `Hero`, `Solution`, `Features`, `HowItWorks`, `LandingFooter` in order. This is the single component `app/page.tsx` renders for anonymous visitors.

All components are presentational only — no props beyond what's needed for composition, no client state (no `"use client"` needed except where `ThemeToggle` or a link requires it, consistent with how those are already used elsewhere).

## Content

- **Badge:** "AI-powered resume tailoring"
- **Headline:** "Tailor your resume to every job, not just one"
- **Subhead:** "Score your resume against a job description, see exactly what's missing, and get a tailored rewrite — before you ever hit submit."
- **Solution rows:**
  1. "Score against the job description" — the original resume is scored first, unmodified, so the before/after comparison stays honest.
  2. "See what's missing" — ATS keyword gaps are surfaced explicitly, not buried in a generic score.
  3. "Get a tailored rewrite" — one click re-runs the optimization against the frozen original, then download as PDF or DOCX in your chosen template.
- **Feature cards:** ATS Score Simulation, Keyword Gap Analysis, One-Click Tailored Rewrite, Master Resume (upload once, reuse across every application), Template Library (modern/minimal styles), Before/After Comparison (original score is never overwritten).
- **How it works steps:** 1) Upload your master resume once. 2) Paste the job description for a role. 3) Get scored, then optimize — download the tailored version.

Copy is grounded in the app's actual score-then-optimize flow (per `CLAUDE.md`'s Request Flow section) rather than generic AI-tool marketing language.

## Visual style

No new design tokens — reuses the existing `app/globals.css` variables exclusively: `--accent` (#9184d9) for CTAs/badges/links, `--surface`/`--surface-alt` for card backgrounds, `--border-hairline` for dividers/frames, `--radius-card` (14px) for corners, `var(--card-shadow)` for elevation. Content column: `max-w-[1100px] mx-auto` (wider than the dashboard's `max-w-[760px]`, appropriate for a marketing page rather than a data table). Generous section padding for whitespace. Fully responsive/mobile-first: feature grid collapses to 1 column, Solution rows stack vertically, header collapses CTAs appropriately at narrow widths. Both light and dark themes supported automatically via the existing CSS custom properties and `.dark` class toggle — no additional theming work needed.

## Verification

This repo has no automated test runner (manual verification per task). Verification steps:
1. `npm run dev`, view `/` while logged out — confirm the landing page renders instead of a redirect.
2. Toggle light/dark theme, confirm both look correct.
3. Resize to mobile width, confirm responsive collapse of header, hero, feature grid, and solution rows.
4. Click primary CTA → lands on `/signup`; click secondary CTA / header "Log in" → lands on `/login`.
5. Log in and reload `/` — confirm the existing applications dashboard still renders unchanged.
