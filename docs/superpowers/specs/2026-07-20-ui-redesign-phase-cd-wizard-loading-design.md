# UI Redesign — Phase C+D: Wizard + Loading Views

**Date:** 2026-07-20
**Status:** Approved

## Overview

Combined phase (merged at the user's request) covering what was originally scoped as two separate phases:

- **Phase C**: the 3-step new-application wizard (`app/applications/new/page.tsx`, `ApplicationDetailsStep`, `ResumeSourceStep`, `JobDescriptionStep`) plus a real stepper in `AppHeader`.
- **Phase D**: splitting `LoadingView` into distinct scoring/optimizing variants and wiring each to where it actually belongs.

These are combined because the wizard's submit step and the loading views it triggers are one continuous user-facing flow, and because fixing the loading views requires touching the wizard page anyway.

## Current-state findings (why this phase is needed, not just cosmetic)

- The wizard already implements the score-then-optimize architecture correctly at the data layer: submitting the job-description step calls `POST /api/score` and redirects to `/applications/:id` — it does **not** call `/api/optimize`. But its loading screen (`components/LoadingView.tsx`) still says **"Optimizing your resume"** with copy about rewriting bullet points — leftover text from before the score/optimize split. This is a real bug, not just an unstyled screen.
- The detail page's "Optimize this resume" button (`app/applications/[id]/page.tsx` → `ScoringView`) has **no full-screen loading view at all** during `POST /api/optimize` — only the button's own label changes to "Optimizing...". The reference design calls for a dedicated full-screen "Optimizing" loading view here, same shape as the scoring one but different copy/icon, and today nothing fills that gap.
- `app/applications/new/page.tsx` has its own ad-hoc local `Stepper` function using old gray/blue classes. Phase B's `AppHeader` spec deliberately shipped without a `stepperItems` prop, noting "Phase C will extend it" — this is that phase.

## Design tokens

Reuses existing tokens only (`bg-surface`, `text-text-primary`, `text-text-secondary`, `border-border-hairline`, `text-accent`, `border-accent`, `bg-accent-surface`, `bg-chip-neutral-bg`, `rounded-card`). No new tokens.

## Standing centering principle (carried forward — see Phase A spec)

Every step's `max-w-*` container gets `mx-auto`, matching the reference's per-step widths: Details `max-w-[440px]`, Resume `max-w-[480px]`, Job description `max-w-[600px]`. The loading views themselves also get `max-w-[380px] mx-auto` (matching the reference).

## Component: `AppHeader` — add stepper support

**Files:** `components/AppHeader.tsx`

Extend the props (this is additive — `rightSlot` behavior is unchanged):

```tsx
interface StepperItem {
  label: string;
  state: "done" | "current" | "pending";
}

interface AppHeaderProps {
  rightSlot?: ReactNode;
  stepperItems?: StepperItem[];
}
```

When `stepperItems` is provided, render numbered circles between the wordmark and `rightSlot`: `done` = filled accent circle with a checkmark (checkmark color `text-bg`, so it auto-contrasts in both themes since `--color-bg` flips light/dark), `current` = transparent circle with a 1.5px accent border and accent-colored number, `pending` = `bg-surface` circle with `text-text-secondary` number. A `1px` `bg-border-hairline` hairline connects consecutive circles. Label text next to each circle: `text-text-primary` when current, `text-text-secondary` otherwise.

## Component changes: wizard steps

### `components/ApplicationDetailsStep.tsx`

Restyle only — same props (`companyName`, `roleTitle`, `onCompanyNameChange`, `onRoleTitleChange`, `onNext`), same `canProceed` logic. Labeled inputs (`bg-surface border-border-hairline rounded-lg`), outlined accent "Next" button (disabled/45% opacity until valid), section label in `text-accent uppercase text-[11px]`.

### `components/ResumeSourceStep.tsx`

Restyle only — same props/logic (`ResumeSource` type, `useDropzone`, `hasMaster`/`useUpload`/`file`/`saveAsMaster` state all unchanged). Radio rows become custom circles (accent-filled when selected) instead of native `<input type="radio">` visuals — but keep real `<input type="radio">` elements for accessibility/keyboard support, just visually restyled (hidden native input + a styled circle, standard technique — do not remove the underlying `<input>`). Dropzone: dashed `border-border-hairline` idle state, filled state with checkmark + filename + "Choose a different file" link. Checkbox for "save as master" similarly restyled (real `<input type="checkbox">`, custom visual). Back button: outlined neutral (`border-border-hairline`). Next: outlined accent, disabled until valid.

### `components/JobDescriptionStep.tsx`

Restyle only. Drop the `loading: boolean` prop — it's dead code today (the component unmounts before the wizard ever renders it with `loading === true`, since the parent swaps to `LoadingView` first) and won't be needed once the parent explicitly handles the loading swap. `onSubmit`/`onBack`/`onChange` unchanged. Textarea: `bg-surface border-border-hairline rounded-lg`, 10 rows. "Score my resume" button (star icon) replaces the current "Optimize" label — the wizard step scores, it doesn't optimize; outlined accent, disabled until non-empty.

## Component: `LoadingView` — split into a `variant` prop

**Files:** `components/LoadingView.tsx`

```tsx
interface LoadingViewProps {
  variant: "scoring" | "optimizing";
}
```

One component, not two files — internal `MESSAGES`/`ICON`/`TITLE`/`SUBTITLE` are selected by `variant`. Same progress-bar mechanism for both (existing asymptotic fake-progress, `BASE_RATE = 1.2`, `MAX_PROGRESS = 88`, unchanged — this part already works and matches the reference).

| | scoring | optimizing |
|---|---|---|
| Icon | 48px spinning ring (`border-[2.5px] border-border-hairline border-t-accent animate-spin`, `rounded-full`) | 48px box (`rounded-xl border border-accent-surface`) containing a static `IconSparkles` (`text-accent`, `animate-pulse`) |
| Title | "Scoring your resume" | "Optimizing your resume" |
| Subtitle | "This usually takes 10–15 seconds." | "Rewriting content to match the role." |
| Messages | "Reading your resume...", "Parsing sections...", "Comparing against the job description...", "Identifying keyword gaps...", "Calculating ATS alignment..." | "Reviewing suggested improvements...", "Rewriting bullet points...", "Weaving in missing keywords...", "Polishing your summary...", "Finalizing your optimized resume..." |

(Replaces the current 7-item `MESSAGES` array, which predates the reference handoff's finalized copy — adopting the reference's copy verbatim per its "copy is final" instruction.)

Progress bar track: `bg-chip-neutral-bg` (this token's value, `#3f424d` dark / `#e9e9ee` light, already matches the reference's literal track color), fill `bg-accent`.

## Component changes: wiring the loading views

### `app/applications/new/page.tsx`

- Replace the local `Stepper` function + inline `<header>` with `<AppHeader stepperItems={...} />`, computing `stepperItems` from the existing `STEPS`/`step` state (same 3 entries: Details, Resume, Job description).
- Replace `{loading && <LoadingView />}` with `{loading && <LoadingView variant="scoring" />}`.
- Remove the now-unused `loading` prop passed to `JobDescriptionStep`.
- `handleSubmit`, `STEPS`, `stepIndex`, all step state: unchanged.

### `app/applications/[id]/page.tsx`

- When `application.resumeData === null && optimizing === true`, render `<LoadingView variant="optimizing" />` instead of `<ScoringView />`. When `optimizing === false`, render `<ScoringView />` as today.
- `handleOptimize`, `optimizing`/`optimizeError` state, `handleDelete`: unchanged.
- This page's header should also move to `<AppHeader />` (no `rightSlot`, no stepper) for consistency with the dashboard/wizard — it's currently using the same old inline header pattern the dashboard had before Phase B.

## Data Flow

Unchanged. Wizard: `handleSubmit` → `POST /api/score` → redirect to `/applications/:id`. Detail page: `handleOptimize` → `POST /api/optimize` → updates `application` state in place (no navigation). This phase only changes what renders during the `loading`/`optimizing` windows and the visual styling — no request/response shape changes.

## Error Handling

Unchanged. Wizard: `error` state shown above the step content (existing red banner treatment) when `!loading`, so it doesn't fight with `LoadingView`. Detail page: `optimizeError` passed to `ScoringView` as today (shown when not optimizing).

## Testing

No test runner in this repo — manual verification per task in the implementation plan.
