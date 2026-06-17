# Loading Screen Design

**Date:** 2026-06-17  
**Status:** Approved

## Overview

Add a dedicated loading screen that replaces the job description step content while the `/api/optimize` request is in flight. The screen shows a fake-progress bar and cycling status messages to keep the user engaged during the typical 10–15 second wait.

## Architecture

No new route or API change. The loading state is entirely client-side, driven by the existing `loading` boolean in `app/page.tsx`.

**Render logic change in `page.tsx`:**
- When `loading === true`: render `<LoadingView />` (new component)
- When `!loading && step === "jobDescription"`: render `<JobDescriptionStep />` (existing, unchanged)
- When `step === "result"`: render `<ResultView />` (unchanged)

The `Stepper` stays on "Job description" during loading — no new step added to the `STEPS` array.

## Component: `components/LoadingView.tsx`

Self-contained React component. No props needed. Uses `useState` + `useEffect` only.

### Progress bar

- Fake linear progress via `setInterval` (150ms tick).
- Advances fast early (~0.8% per tick), slows down as it approaches 85%, then holds there.
- On unmount (API response received), the parent swaps to `<ResultView />` naturally — no explicit "jump to 100%" needed, since the component is removed from the DOM.

Easing formula:
```
increment = BASE_RATE * (1 - progress / MAX_PROGRESS)
```
Where `BASE_RATE = 1.2` and `MAX_PROGRESS = 88`. This gives a natural deceleration that asymptotically approaches 88%.

### Status messages

Cycle every 2500ms via a separate `setInterval`. Messages in order (wrap around):

1. "Analyzing job description..."
2. "Identifying key requirements..."
3. "Scanning your resume..."
4. "Matching skills and keywords..."
5. "Tailoring your experience sections..."
6. "Scoring ATS compatibility..."
7. "Finalizing optimizations..."

### Visual layout

Centered in the content area (no full-screen overlay — fits within the existing `<main>` container):

```
[  sparkles icon  ]
Optimizing your resume
subtitle: "This usually takes 10–15 seconds"

[████████████░░░░░░░░]  62%

Matching skills and keywords...
```

- Progress bar: `h-2`, rounded, blue fill (`bg-blue-600`) on gray track (`bg-gray-100`)
- Percentage shown to the right of the bar
- Status message: `text-sm text-gray-500`, centered, italic

## Data Flow

```
User clicks "Optimize"
  → handleSubmit() sets loading=true
  → page.tsx renders <LoadingView /> instead of <JobDescriptionStep />
  → LoadingView starts progress interval + message interval
  → API responds (~10–15s)
  → handleSubmit() sets loading=false, step="result"
  → page.tsx unmounts <LoadingView />, renders <ResultView />
  → useEffect cleanup cancels both intervals
```

## Error Handling

No change to error handling. If the API fails, `loading` is set to `false` and `error` is set. Since `step` remains `"jobDescription"`, the job description form re-appears with the error message above it (existing behavior). `LoadingView` unmounts cleanly via the existing `finally` block.

## Testing

Manual golden path:
1. Upload a resume, paste a job description, click "Optimize"
2. Verify loading screen appears immediately (job description form gone)
3. Verify progress bar advances and messages cycle
4. Verify results appear when API responds
5. Verify error case: if API fails, job description form reappears with error

No unit tests required for this change — it's pure UI/animation with no logic to test in isolation.
