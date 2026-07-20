# UI Redesign — Phase E: Scoring View + Result View + Template Preview Modal

**Date:** 2026-07-20
**Status:** Approved

## Overview

Final phase of the redesign. Restyles the two remaining pre-redesign screens (`ScoringView`, `ResultView`, and `TemplateSelector`, which `ResultView` embeds) with the Phase A/B/C+D design tokens, adds animated score gauges, and introduces a new template-preview modal that didn't exist before.

No API/data-shape changes. `ScoringView`/`ResultView`/`TemplateSelector` keep their exact current props and logic — this is markup/token restyling plus one new component (`TemplatePreviewModal`) and one new shared hook (`useCountUp`).

## Standing principles carried forward (see Phase A spec)

- Every `max-w-*` container gets `mx-auto`.
- The template-preview modal is a `justify-center` overlay (the reference already writes this one correctly — keep it that way).

## New shared hook: `lib/hooks/useCountUp.ts`

```ts
function useCountUp(from: number, to: number, durationMs?: number): number
```

Animates a number from `from` to `to` using `requestAnimationFrame` with ease-out cubic easing (`1 - (1-t)^3`), defaulting to ~950ms — per the handoff's explicit instruction to use rAF rather than `setInterval` for this. Re-runs whenever `to` (or `from`) changes. Used by:
- `ScoringView`: single gauge, `useCountUp(0, atsScore)` on mount.
- `ResultView`: "after" gauge, `useCountUp(previousAtsScore, atsScore)` on mount. The "before" gauge is static (no animation — it's a fixed historical value).

## Component changes

### `components/ScoringView.tsx`

Same props (`atsScore`, `matchedKeywords`, `missingKeywords`, `suggestions`, `onOptimize`, `optimizing`, `error`) — restyle only:
- Circular gauge: SVG `stroke-dasharray` ring (112px, matching the reference), neutral track (`border-hairline`-equivalent stroke color), `accent` stroke for progress, using `useCountUp` for the displayed number. Caption "ATS alignment" + `suggestions.headline` beside it.
- Matched/missing keyword chips: `bg-accent-surface text-accent-surface-text` / `bg-chip-neutral-bg text-chip-neutral-text` (same chip pattern already established on the dashboard's status chips).
- Suggestions list: `bg-surface` card, accent em-dash bullets.
- "Optimize this resume" button: full-width outlined accent, star icon, `disabled` + label swap while `optimizing`.
- Error banner: same red-surface treatment used everywhere else in this redesign.

### `components/ResultView.tsx`

Same props — restyle only:
- Before/after gauge pair: two SVG rings side by side with an arrow between. "Before" ring uses a muted stroke color (not accent — it's historical, shouldn't compete visually with "after") and shows `previousAtsScore` statically. "After" ring uses `accent` stroke and `useCountUp(previousAtsScore, atsScore)`.
- Keywords-added / still-missing chips: same chip tokens as `ScoringView`. The existing `keywordsAdded` derivation (normalize + filter against `previousMissingKeywords`) is unchanged — this logic was already fixed for false-negative matching in an earlier commit (`7bcedce`), don't touch it.
- "What changed" card: same `bg-surface` card pattern, accent checkmark bullets (reference uses a check glyph here, vs. em-dash in `ScoringView`'s suggestions — keep that distinction, it visually differentiates "things to do" from "things done").
- `TemplateSelector`: see below.
- Download button: **already correctly implemented** — `downloading` state is driven by the real `authFetch("/api/resume/render")` promise, not a timer. Only the visual treatment changes (outlined accent, download icon, label text unchanged: "Download PDF" / "Generating PDF...").
- "Back to dashboard" button (renamed from "Go Back" per the handoff copy): outlined neutral, calls existing `onRestart`.

### `components/resume/TemplateSelector.tsx`

Same props (`selectedTemplateId`, `onSelect`) and same data source (`GET /api/templates`, the existing `ModernPreview`/`MinimalPreview` SVG thumbnail components — unchanged, still using their current placeholder "Alex Johnson" mock data, since the API doesn't provide real resume content to a template list endpoint and this phase isn't changing that). Adds:
- Restyled card grid: `bg-surface`, selected state = 2px accent ring + filled accent checkmark badge (top-right), matching the dashboard/application-row selection patterns already established.
- **New "Preview" link** per card, top-right next to the template name, `text-accent`, `onClick` stops propagation (doesn't trigger card selection) and opens `TemplatePreviewModal` for that template — selection itself is unchanged (clicking the card, not the link, still calls `onSelect` directly as today).
- New local state: `previewTemplateId: string | null` (which template's modal is open, `null` = closed) — lives in `TemplateSelector`, not lifted to `ResultView`, since it's pure presentation state per the handoff.

## New component: `components/resume/TemplatePreviewModal.tsx`

```tsx
interface TemplatePreviewModalProps {
  templateName: string;
  onClose: () => void;
  onUseTemplate: () => void;
}
```

Centered fixed-position overlay: `position: fixed; inset: 0; flex items-center justify-center` backdrop (`bg-black/50` equivalent — semi-transparent dark scrim, works in both themes since it's opacity-based, not a token), clicking the backdrop calls `onClose`. Dialog card (`bg-surface rounded-card`, the modal shadow from the reference: `0 0 0 1px [border], 0 16px 40px rgba(0,0,0,.65)` dark / a lighter equivalent in light) with a `stopPropagation` click guard so clicking inside doesn't close it. Header: "`{templateName}` template preview" + an `×` close button. Body: **a placeholder preview area** — a bordered `bg-surface-alt` box (no per-template rendering yet; the user will swap in real preview images/content in a later pass) with a simple centered icon + "Preview coming soon" text, sized to roughly match the reference's preview panel proportions (`~380px` wide, appropriate aspect ratio for a resume page). Footer: "Use this template" button (outlined accent) — calls `onUseTemplate` then `onClose`.

This is intentionally simple/placeholder per the user's explicit direction ("I will add images later, right now just add a placeholder") — do not build per-template SVG rendering or PDF-embedding logic in this phase.

## Data Flow

Unchanged everywhere. No new API calls, no new request/response shapes. `TemplatePreviewModal` is pure client state (open/closed + which template), doesn't touch `selectedTemplateId` until "Use this template" is clicked.

## Error Handling

Unchanged — `ScoringView`'s `error` prop and `ResultView`'s `downloadError` state keep their current display logic, restyled to the same red-surface treatment used throughout this redesign.

## Testing

No test runner in this repo — manual verification per task in the implementation plan.
