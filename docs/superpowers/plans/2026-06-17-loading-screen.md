# Loading Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated loading screen with a fake progress bar and cycling status messages that replaces the job description form while the optimize API call is in flight.

**Architecture:** A new `LoadingView` component manages its own progress/message state via `useEffect` intervals. `app/page.tsx` conditionally renders it instead of `JobDescriptionStep` when `loading === true`. No API or routing changes required.

**Tech Stack:** React (useState, useEffect), Tailwind CSS, Next.js (existing stack)

## Global Constraints

- No new dependencies — use only existing React hooks and Tailwind classes already in the project
- Do not modify the `STEPS` array or `Stepper` component — stepper stays on "Job description" during loading
- Do not alter `JobDescriptionStep`, `ResultView`, or any API route
- Tailwind classes only — no inline styles, no CSS modules

---

### Task 1: Create `LoadingView` component

**Files:**
- Create: `components/LoadingView.tsx`

**Interfaces:**
- Consumes: nothing (no props)
- Produces: `export function LoadingView(): JSX.Element` — used by Task 2

- [ ] **Step 1: Create the file with progress bar logic**

Create `components/LoadingView.tsx` with the following complete implementation:

```tsx
"use client";

import { useEffect, useState } from "react";
import { IconSparkles } from "@tabler/icons-react";

const MESSAGES = [
  "Analyzing job description...",
  "Identifying key requirements...",
  "Scanning your resume...",
  "Matching skills and keywords...",
  "Tailoring your experience sections...",
  "Scoring ATS compatibility...",
  "Finalizing optimizations...",
];

const BASE_RATE = 1.2;
const MAX_PROGRESS = 88;

export function LoadingView() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= MAX_PROGRESS) return prev;
        const increment = BASE_RATE * (1 - prev / MAX_PROGRESS);
        return Math.min(prev + increment, MAX_PROGRESS);
      });
    }, 150);

    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 space-y-6">
      <div className="flex flex-col items-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
          <IconSparkles size={20} className="text-blue-600" />
        </div>
        <h2 className="text-lg font-medium text-gray-900">Optimizing your resume</h2>
        <p className="text-sm text-gray-400">This usually takes 10–15 seconds</p>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-150 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 tabular-nums w-8 text-right">
            {Math.round(progress)}%
          </span>
        </div>

        <p className="text-sm text-gray-500 italic text-center">{MESSAGES[messageIndex]}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file was created correctly**

Check that `components/LoadingView.tsx` exists and exports `LoadingView`. The component:
- Has two `setInterval` calls (one for progress, one for messages)
- Both are cleaned up in the `useEffect` return function
- Progress caps at `MAX_PROGRESS` (88) and never reaches 100 on its own

- [ ] **Step 3: Commit**

```bash
git add components/LoadingView.tsx
git commit -m "feat: add LoadingView component with progress bar and cycling messages"
```

---

### Task 2: Wire `LoadingView` into `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `LoadingView` exported from `components/LoadingView.tsx` (Task 1)
- Produces: updated render logic — `LoadingView` shown when `loading === true`

- [ ] **Step 1: Add the import**

In `app/page.tsx`, add the import after the existing component imports (around line 8):

```tsx
import { LoadingView } from "@/components/LoadingView";
```

- [ ] **Step 2: Update the render logic in the `<main>` block**

Find the existing block inside `<main>` (lines 129–154):

```tsx
{step === "upload" && (
  <UploadStep
    file={file}
    onFileChange={setFile}
    onNext={() => setStep("jobDescription")}
  />
)}
{step === "jobDescription" && (
  <JobDescriptionStep
    jobDescription={jobDescription}
    onChange={setJobDescription}
    onBack={() => setStep("upload")}
    onSubmit={handleSubmit}
    loading={loading}
  />
)}
{step === "result" && result && (
  <ResultView
    atsScore={result.atsScore}
    matchedKeywords={result.matchedKeywords}
    missingKeywords={result.missingKeywords}
    summaryOfChanges={result.summaryOfChanges}
    resumeData={result.resumeData}
    onRestart={handleRestart}
  />
)}
```

Replace it with:

```tsx
{step === "upload" && (
  <UploadStep
    file={file}
    onFileChange={setFile}
    onNext={() => setStep("jobDescription")}
  />
)}
{loading && <LoadingView />}
{!loading && step === "jobDescription" && (
  <JobDescriptionStep
    jobDescription={jobDescription}
    onChange={setJobDescription}
    onBack={() => setStep("upload")}
    onSubmit={handleSubmit}
    loading={loading}
  />
)}
{step === "result" && result && (
  <ResultView
    atsScore={result.atsScore}
    matchedKeywords={result.matchedKeywords}
    missingKeywords={result.missingKeywords}
    summaryOfChanges={result.summaryOfChanges}
    resumeData={result.resumeData}
    onRestart={handleRestart}
  />
)}
```

- [ ] **Step 3: Manual verification**

Run the dev server:
```bash
npm run dev
```

Test the golden path:
1. Open `http://localhost:3000`
2. Upload a resume file (`.docx` or `.pdf`)
3. Paste any job description text
4. Click "Optimize"
5. **Verify:** The job description form disappears and the loading screen appears immediately
6. **Verify:** The progress bar fills left-to-right, slowing as it approaches ~88%
7. **Verify:** The status message changes every ~2.5 seconds, cycling through the 7 messages
8. **Verify:** The percentage counter increments smoothly
9. **Verify:** When the API responds, results appear normally
10. **Verify:** Stepper stays on "Job description" throughout loading

Test the error path:
1. Disconnect network (or use devtools to block `/api/optimize`)
2. Click "Optimize"
3. **Verify:** Loading screen appears
4. **Verify:** After the request fails, loading screen disappears and job description form reappears with the error message

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: show LoadingView during optimize API call"
```
