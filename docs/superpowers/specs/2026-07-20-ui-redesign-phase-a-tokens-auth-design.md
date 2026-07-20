# UI Redesign — Phase A: Design Tokens + Auth Screens

**Date:** 2026-07-20
**Status:** Approved

## Overview

First phase of a multi-phase visual/interaction redesign (source: `Resume Optimizer (reference).dc.html` handoff — a standalone HTML/pseudo-React mock, not production code). The full redesign spans auth, dashboard, the new-application wizard, loading views, scoring view, and result view; each is its own phase with its own design → plan → build cycle. This phase covers:

1. The shared design-token foundation (dark palette from the reference, plus a new complementary light palette — the reference is dark-only but this app keeps its existing light/dark toggle).
2. Restyled Login (`app/login/page.tsx`) and Signup (`app/signup/page.tsx`) screens.

No new routes, no new state, no API/schema changes. Purely a markup/class restyle of two existing pages plus new CSS tokens.

## Decisions from brainstorming

- **Keep the light/dark toggle** (`ThemeToggle`, `lib/theme/themeStore`) — the reference has no toggle because it's a dark-only mock, but the current app already supports both themes and that's staying. This phase adds a light-mode palette that doesn't exist in the reference; it mirrors the same structural roles (bg/surface/border/text/accent) at the same radii/spacing as the dark palette, built off the current app's existing light look (white bg, dark-gray text) with the accent swapped to purple.
- **Signup drops the "Full name" field** shown in the reference mock. The real `signup()` (`lib/auth/AuthContext.tsx`) only accepts `(email, password)` — there is no name field anywhere in the `User` schema or API. Adding one is a feature, not a restyle, and out of scope here.
- **No "forgot password" link** — explicitly flagged as a question in the handoff; no password-reset flow exists in the backend, so skipping it rather than adding a link to nowhere.

## Design tokens

Extends the existing CSS-variable pattern in `app/globals.css` (`:root` for light, `.dark` for dark, surfaced to Tailwind via `@theme inline`) — same mechanism already used for `--color-background`/`--color-foreground`, just more roles.

| Token | Dark (from reference) | Light (new, proposed) |
|---|---|---|
| `--color-bg` | `#161826` | `#ffffff` |
| `--color-surface` | `#232532` | `#f4f3fa` |
| `--color-surface-alt` | `#1c1e2c` | `#f0eff8` |
| `--color-border` | `rgba(233,233,237,0.16)` | `rgba(32,34,44,0.12)` |
| `--color-border-dashed` | `rgba(233,233,237,0.25)` | `rgba(32,34,44,0.2)` |
| `--color-text-primary` | `#e9e9ed` | `#20222c` |
| `--color-text-secondary` | `rgba(233,233,237,0.55)` | `rgba(32,34,44,0.6)` |
| `--color-accent` | `#9184d9` | `#9184d9` |
| `--color-accent-surface` | `#423a6a` | `#e7e5fe` |
| `--color-accent-surface-text` | `#f5f4ff` | `#5d5294` |
| `--color-chip-neutral-bg` | `#3f424d` | `#e9e9ee` |
| `--color-chip-neutral-text` | `#f3f5fe` | `#30323c` |

Radii: `--radius-sm: 8px` (buttons, inputs, cards, chips), `--radius-lg: 14px` (modals, banners). Font stays Inter via the existing `Geist`-adjacent setup — reference calls for Inter specifically, so swap the `next/font/google` import from `Geist` to `Inter` in `app/layout.tsx` (keep `Geist_Mono` for any monospace use, unaffected). Buttons are outlined only: `1px solid var(--color-accent)`, transparent background, `var(--color-accent)` text — the one button style used everywhere, no filled/solid buttons anywhere in either theme.

These become Tailwind utilities (`bg-surface`, `text-primary`, `border-hairline`, `rounded-sm`/`rounded-lg` already exist as Tailwind defaults so custom radius tokens get distinct names, e.g. `rounded-card`) via `@theme inline` in `globals.css`, so components use ordinary Tailwind classes rather than inline styles or raw `var()` calls.

## Component changes

### `app/login/page.tsx`, `app/signup/page.tsx`

Layout: **true centered card** — `flex items-center justify-center`, `p-[6vw]`, `max-w-[380px]` card wrapper. (**Correction, 2026-07-20:** the reference's literal padding — `6vw 6vw 6vw clamp(24px,8vw,120px)`, i.e. an asymmetric left padding instead of `justify-center` — was implemented first and read as unintentionally left-aligned in the browser; the user flagged it immediately and it was fixed to `justify-center`. See the standing principle below — this applies to every future phase, not just this one.) `ThemeToggle` stays top-right (absolute), unchanged from current behavior. Wordmark "Resume**Tailor**" (Tailor in `text-accent`) above the card, `text-[19px] font-medium tracking-[-0.015em]`.

Card: `bg-surface rounded-card` (14px), shadow only on this card (`shadow-[0_0_0_1px_theme(colors.border),0_6px_18px_rgba(0,0,0,0.55)]` in dark; a lighter equivalent shadow in light mode — e.g. `0_0_0_1px_theme(colors.border),0_6px_18px_rgba(0,0,0,0.08)`). Title (`text-[22px] font-medium`), subtitle in `text-secondary`, stacked labeled inputs (`bg-bg border border-hairline rounded-sm`), full-width outlined accent button, and the "switch screen" link line below the form — all restyled with the new tokens, same JSX structure/order as today.

Signup form fields: Email, Password (+ existing "At least 8 characters" hint) — **no Full name field**. `handleSubmit`, `login`/`signup` calls, `error`/`loading` state: unchanged.

### Error display

Existing inline error paragraph above the fields, restyled to a semantic error surface (not accent — accent stays reserved for interactive/brand elements per the reference's token rules): `bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900 text-red-700 dark:text-red-300` mapped onto the new radius (`rounded-sm`) but keeping Tailwind's existing red palette (no new error token needed — error color isn't part of the reference's token set).

## Data Flow

Unchanged. `handleSubmit` → `login(email, password)` / `signup(email, password)` → `router.push("/")` on success, `setError(...)` on failure. This phase touches only JSX/className, not logic.

## Error Handling

Unchanged behavior (see above) — only the visual treatment of the error message changes.

## Standing design principle (applies to every future phase)

**Use real flexbox centering (`items-center justify-center`) for any centered card/modal/dialog layout — never approximate centering with asymmetric padding**, even if that's what the reference `.dc.html` mockup's literal inline CSS does. The reference sometimes centers via viewport-relative padding math (`clamp(24px,8vw,120px)` on one side only) that happens to look centered in the specific frame it was designed at, but reads as visibly off-center at other viewport widths or in a real browser. `justify-center` is the actual requirement; treat any reference padding-based "centering" as an implementation detail to replace, not to port literally.

This applies directly to Phase E's template-preview modal (the reference already writes that one correctly, with `display:flex;align-items:center;justify-content:center` — keep it that way) and to any other centered element introduced in Phases C/D/E. Inline page content that naturally flows left under the app header (dashboard, wizard steps) is a different pattern and this rule doesn't apply there — only to elements meant to be visually centered on the page/viewport.

## Testing

No test runner in this repo (manual verification per task). Manual golden path:
1. `npm run dev`, visit `/login` in both light and dark (toggle), confirm card/inputs/button match the token table and outlined-button style.
2. Submit invalid credentials, confirm error banner renders with new styling in both themes.
3. Visit `/signup`, confirm only Email/Password fields (no name field), submit, confirm redirect to `/`.
4. Click the "Create an account" / "Log in" swap links, confirm navigation between `/login` and `/signup`.
5. Resize to a narrow viewport, confirm the card padding/layout stays usable (no horizontal scroll).
