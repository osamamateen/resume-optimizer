# Landing page mockup screens

## Problem

The landing page (`docs/superpowers/specs/2026-07-22-landing-page-design.md`) shipped with four "Product preview" placeholder frames (1 in `Hero.tsx`, 3 in `Solution.tsx`), deliberately deferred at the time pending real screenshots. The user now wants those filled with actual mockup screens instead of continuing to wait on real screenshots.

## Scope

In scope: four new static, presentational mockup components, each dropped into one existing placeholder frame, replacing its "Product preview" label. No layout, spacing, copy, or token changes outside of what's needed to host the mockups.

Out of scope: real screenshots (still not being used), any interactivity (mockups are static illustrations, not live data), changes to the actual app screens they're based on.

## Design

Each mockup is a faithful, shrunk-down recreation of a real app screen, built from the same Tailwind classes/SVG math already used by the real components — not a new visual language. Illustrative sample data only (fixed numbers/strings), no props, no fetching.

- **`components/landing/mockups/HeroMockup.tsx`** — hosted in `Hero.tsx`'s wide `aspect-video` frame. Recreates the dashboard: a 3-card stats row (Applications/Average score/Optimized) plus two application rows, styled exactly like `app/page.tsx`'s real stats cards and list rows (`bg-accent-surface`/`text-accent-surface-text` "Optimized" chip vs. `bg-chip-neutral-bg`/`text-chip-neutral-text` "Scored" chip). Sample data: "Senior Product Manager · Acme Inc" (Optimized, 92/100) and a dimmed "Growth Lead · Northwind" (Scored, 78/100) row underneath for depth.
- **`components/landing/mockups/ScoreMockup.tsx`** — hosted in `Solution.tsx` row 1 ("Score against the job description"). Recreates `ScoringView.tsx`'s circular SVG gauge (same `stroke-dasharray`/`stroke-dashoffset` approach, `stroke-accent` progress arc over `stroke-chip-neutral-bg` track) at a smaller size, showing a fixed 74/100 plus a one-line "ATS alignment" caption.
- **`components/landing/mockups/KeywordsMockup.tsx`** — hosted in `Solution.tsx` row 2 ("See what's missing"). Recreates `ScoringView.tsx`'s matched/missing keyword chip groups (same two chip color pairs), with a handful of illustrative keywords per group.
- **`components/landing/mockups/RewriteMockup.tsx`** — hosted in `Solution.tsx` row 3 ("Get a tailored rewrite"). Recreates `ResultView.tsx`'s before/after gauge pair (68 → 91, same circumference/offset math, arrow between them) plus a small non-interactive "Download PDF" button visual underneath, matching the real button's icon/label.

**Wiring:**
- `Hero.tsx`: the existing placeholder frame (`rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-video`) drops its `items-center justify-center` + "Product preview" `<span>` in favor of `overflow-hidden` + `<HeroMockup />`, which fills the frame itself.
- `Solution.tsx`: `SolutionRow` gains a `visual: ReactNode` field. Each of the 3 rows points at its matching mockup component. The existing frame div (`rounded-card border border-border-hairline bg-surface shadow-[var(--card-shadow)] aspect-[4/3] flex items-center justify-center`) gains `overflow-hidden` and renders `{row.visual}` instead of the placeholder `<span>`.

No new dependencies, no new design tokens — every class used already exists in `app/globals.css` / is already used by `ScoringView.tsx`, `ResultView.tsx`, or `app/page.tsx`.

## Verification

Same manual-verification approach as the parent landing-page spec (no automated test runner in this repo): `npm run build` to type-check each new file, then a headless-browser pass confirming all four mockups render with the correct sample data/visuals in both light and dark themes, at desktop and mobile widths, with no console errors.
