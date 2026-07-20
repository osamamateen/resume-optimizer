# UI Redesign — Phase B: Shared App Header + Dashboard

**Date:** 2026-07-20
**Status:** Approved

## Overview

Second phase of the multi-phase visual/interaction redesign (see Phase A spec: `docs/superpowers/specs/2026-07-20-ui-redesign-phase-a-tokens-auth-design.md`). This phase:

1. Extracts a shared `AppHeader` component (wordmark, optional right-side content) from the dashboard's inline header, so the wizard/scoring/result screens in later phases can reuse it instead of re-implementing the same markup.
2. Extends `GET /api/applications` to report per-application optimized status.
3. Redesigns the dashboard (`app/page.tsx`): stats row, restyled master-resume banner, application list with status chips, empty state — using the Phase A design tokens.

## Base-branch note

This work happens in a worktree rebased onto `feature/score-then-optimize` (not `main`) — see the project memory `project_resume_optimizer_ui_redesign` for why. The dashboard's Scored/Optimized distinction depends on `Application.resumeData` being nullable, which is only true on that branch (`prisma/schema.prisma`: "Only populated once Optimize has been run").

## Design tokens

Reuses Phase A's tokens (`bg-bg`, `bg-surface`, `text-text-primary`, `text-text-secondary`, `border-border-hairline`, `text-accent`, `border-accent`, `bg-accent-surface`, `text-accent-surface-text`, `bg-chip-neutral-bg`, `text-chip-neutral-text`, `rounded-card`). No new tokens needed for this phase — the reference's dashboard uses only colors/radii already defined.

## API change

### `GET /api/applications` (`app/api/applications/route.ts`)

Current `select` only returns `id, companyName, roleTitle, atsScore, createdAt`. Add `resumeData: true` to the Prisma select, then in the route handler map each row to `{ id, companyName, roleTitle, atsScore, createdAt, optimized: resumeData !== null }` — dropping the raw `resumeData` field from the response (the list view has no use for the full JSON payload, and it can be large).

## Component: `components/AppHeader.tsx` (new)

Renders the shared top bar used on every authenticated screen (dashboard now; wizard/scoring/result in later phases):

- Left: "Resume**Tailor**" wordmark (Tailor in accent), clickable, navigates to `/`.
- Right: an optional `rightSlot?: React.ReactNode` prop for screen-specific content. Dashboard passes `<ThemeToggle />` + a "Log out" button (matching what `app/page.tsx` already has today — the reference mock omits a theme toggle entirely since it's dark-only, but Phase A already decided to keep the toggle app-wide, so it isn't dropped here).
- A `stepperItems?: StepperItem[]` prop exists on the component signature now (unused, renders nothing when omitted) so Phase C's wizard doesn't need to change the header's public interface — only Phase C will actually pass data through it and render the step dots.

```tsx
interface StepperItem {
  label: string;
  state: "done" | "current" | "pending";
}

interface AppHeaderProps {
  rightSlot?: React.ReactNode;
  stepperItems?: StepperItem[];
}
```

## Component changes

### `app/page.tsx` (dashboard)

- Replace the inline `<header>` block with `<AppHeader rightSlot={...} />`, passing `<ThemeToggle />` and the existing "Log out" button as `rightSlot` (a `<>...</>` fragment).
- `ApplicationSummary` interface gains `optimized: boolean`.
- **Stats row** (rendered only when `applications.length > 0`): 3 cards in a `grid-cols` auto-fit layout — Applications (`applications.length`), Average score (`Math.round(sum(atsScore)/length)`), Optimized (`count(optimized) / length`). Each card: `bg-surface rounded-lg p-4`, label in `text-text-secondary text-[10.5px] uppercase tracking-wide`, value in `text-text-primary text-2xl font-medium`.
- **Master resume banner**: restyle `components/MasterResumeControl.tsx` in place — same `useMasterResume`/`useDropzone` logic, new markup. Present state: `bg-surface border border-accent-surface rounded-lg` banner with a doc icon, "Master resume" label (`text-accent text-[10.5px] uppercase`) + filename, "Replace" as a `text-accent` link-button, right-aligned. Absent state: `bg-surface border border-border-hairline` banner, "No master resume yet — upload one so new applications can reuse it." in `text-text-secondary`, "Upload resume" as an outlined accent button.
- **Application list**: each row `bg-surface rounded-lg p-4`, clickable (`onClick` navigates, keep existing `<button>` semantics), role title (`font-medium`) · company (`text-text-secondary`) · status chip — `optimized ? "Optimized" : "Scored"`, chip bg `optimized ? bg-accent-surface text-accent-surface-text : bg-chip-neutral-bg text-chip-neutral-text` — then date below in `text-text-secondary text-xs`. Right side: `atsScore/100` in `text-text-primary`, chevron icon.
- **Empty state** (0 applications): left-aligned card (`border border-border-hairline rounded-card bg-surface-alt p-8`), resume icon in a small `bg-surface` badge, "No applications yet", subtext, "New application" outlined button. Replaces the stats row and list entirely (not shown alongside them).
- No debug "Preview: …" links — explicitly excluded per the handoff.
- `MasterResumeControl` keeps rendering unconditionally when `loaded` — this phase doesn't add a `hasMasterResume`/`noMasterResume` branch at the `page.tsx` level; that branching already lives inside `MasterResumeControl` itself (it returns `null` until `loaded`, then renders present-or-absent based on `fileName`).

## Data Flow

Unchanged fetch-on-mount pattern: `useEffect` calls `authFetch("/api/applications")` on mount when `accessToken` is set, populates `applications` state. The only change is the shape of each item (`optimized` added) and how stats are derived from that array client-side (no new endpoint for stats — computed in `page.tsx` from the existing list response).

## Error Handling

Unchanged: `error` state set on fetch failure, rendered as the same red banner treatment used on the Phase A auth screens (`bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900 rounded-lg`, kept as Tailwind's built-in red palette + `dark:` variants, not a new token — matches the Phase A precedent of leaving error color outside the semantic token set).

## Testing

No test runner in this repo — manual verification per task, described in the implementation plan.
