# UI Redesign Phase A: Design Tokens + Auth Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the shared dark/light design-token foundation from the redesign handoff and restyle the Login and Signup screens to match it, with zero changes to auth logic, routes, or data shapes.

**Architecture:** Extend the existing CSS-variable pattern in `app/globals.css` (`:root` for light, `.dark` for dark, surfaced to Tailwind via `@theme inline`) with new semantic color/radius tokens, swap the body font from Geist to Inter, then restyle `app/login/page.tsx` and `app/signup/page.tsx` to consume the new Tailwind utility classes those tokens generate (`bg-surface`, `text-primary`, `border-hairline`, `rounded-card`, etc.) instead of raw Tailwind gray/blue classes with manual `dark:` variants.

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4 (`@theme inline`, no `tailwind.config.js`), `next/font/google`, existing `ThemeToggle` / `lib/theme/themeStore` (unchanged).

## Global Constraints

- No new dependencies.
- No changes to `login()`/`signup()` in `lib/auth/AuthContext.tsx`, to `ThemeToggle`, or to `lib/theme/themeStore.ts`.
- No new fields on the signup form (no "Full name" — matches the existing `signup(email, password)` contract).
- No "forgot password" link.
- Buttons stay outlined only: `border border-accent`, transparent background, `text-accent` — no filled/solid buttons.
- Tailwind utility classes only for the two page files — no inline `style={}`, no new CSS files.
- Keep the existing `--background`/`--foreground` variables and the `dark:` custom variant working exactly as they do today — this phase adds tokens alongside them, it doesn't remove the mechanism other (not-yet-restyled) components still rely on.

---

### Task 1: Add design tokens and swap the body font to Inter

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: Tailwind color utilities `bg-bg`, `bg-surface`, `bg-surface-alt`, `border-border-hairline`, `border-border-dashed`, `text-text-primary`, `text-text-secondary`, `bg-accent`/`border-accent`/`text-accent`, `bg-accent-surface`, `text-accent-surface-text`, `bg-chip-neutral-bg`, `text-chip-neutral-text`, and radius utility `rounded-card` (14px) — consumed by Task 2 and Task 3, and by every later redesign phase.
- Produces: CSS var `--card-shadow` (not a Tailwind utility — applied via `shadow-[var(--card-shadow)]` at call sites, since Tailwind v4 can't generate a two-part dark/light shadow as a plain utility name).

- [ ] **Step 1: Replace the contents of `app/globals.css`**

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #ffffff;
  --foreground: #171717;
  --bg: #ffffff;
  --surface: #f4f3fa;
  --surface-alt: #f0eff8;
  --border-hairline: rgba(32, 34, 44, 0.12);
  --border-dashed: rgba(32, 34, 44, 0.2);
  --text-primary: #20222c;
  --text-secondary: rgba(32, 34, 44, 0.6);
  --accent: #9184d9;
  --accent-surface: #e7e5fe;
  --accent-surface-text: #5d5294;
  --chip-neutral-bg: #e9e9ee;
  --chip-neutral-text: #30323c;
  --card-shadow: 0 0 0 1px var(--border-hairline), 0 6px 18px rgba(0, 0, 0, 0.08);
}

.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
  --bg: #161826;
  --surface: #232532;
  --surface-alt: #1c1e2c;
  --border-hairline: rgba(233, 233, 237, 0.16);
  --border-dashed: rgba(233, 233, 237, 0.25);
  --text-primary: #e9e9ed;
  --text-secondary: rgba(233, 233, 237, 0.55);
  --accent: #9184d9;
  --accent-surface: #423a6a;
  --accent-surface-text: #f5f4ff;
  --chip-neutral-bg: #3f424d;
  --chip-neutral-text: #f3f5fe;
  --card-shadow: 0 0 0 1px #3f424d, 0 6px 18px rgba(0, 0, 0, 0.55);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-alt: var(--surface-alt);
  --color-border-hairline: var(--border-hairline);
  --color-border-dashed: var(--border-dashed);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-accent: var(--accent);
  --color-accent-surface: var(--accent-surface);
  --color-accent-surface-text: var(--accent-surface-text);
  --color-chip-neutral-bg: var(--chip-neutral-bg);
  --color-chip-neutral-text: var(--chip-neutral-text);
  --radius-card: 14px;
  --font-sans: var(--font-inter);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
}
```

Note: the previous `body` rule hardcoded `font-family: Arial, Helvetica, sans-serif` and never referenced the font variable at all — the Geist font import was being loaded but not actually applied to body text. This step fixes that in the same change as the Geist→Inter swap, so the new `--font-sans` (now Inter) is what actually renders.

- [ ] **Step 2: Swap the Geist Sans font import for Inter in `app/layout.tsx`**

Replace the full contents of `app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resume Optimizer",
  description: "AI-driven resume optimization tailored to a job description",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#9184d9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >

      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();` }} />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

Two changes from the original: `Geist` → `Inter` (variable renamed `--font-geist-sans` → `--font-inter` to match, and referenced by the new name in `globals.css` from Step 1), and `viewport.themeColor` updated from the old blue (`#2563eb`) to the new accent (`#9184d9`) so the mobile browser chrome matches the new brand color. `Geist_Mono` is untouched — nothing in this codebase currently renders monospace text, so there's no visible effect either way.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

1. Visit `http://localhost:3000/login`.
2. Open browser devtools → Elements → confirm `<html>` has a class containing `--font-inter` (or check computed `font-family` on `<body>` includes "Inter").
3. Confirm the page doesn't 500/type-error (Next.js will fail the build if `Inter`/`Geist_Mono` imports are wrong).
4. No visual change is expected yet from this task alone beyond the font — Login/Signup still use their old classes until Task 2/3.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: add redesign color/radius tokens and swap body font to Inter"
```

---

### Task 2: Restyle the Login screen

**Files:**
- Modify: `app/login/page.tsx`

**Interfaces:**
- Consumes: Tailwind utilities from Task 1 (`bg-bg`, `bg-surface`, `text-text-primary`, `text-text-secondary`, `border-border-hairline`, `text-accent`, `border-accent`, `rounded-card`, `shadow-[var(--card-shadow)]`); `ThemeToggle` from `@/components/ThemeToggle` (unchanged import); `useAuth` from `@/lib/auth/AuthContext` (unchanged).
- Produces: no new exports — this is a page component, routed at `/login`.

- [ ] **Step 1: Replace the contents of `app/login/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary relative flex items-center p-[6vw] pl-[clamp(24px,8vw,120px)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[380px] flex flex-col gap-[26px]">
        <div className="text-[19px] font-medium tracking-[-0.015em]">
          Resume<span className="text-accent">Tailor</span>
        </div>

        <div className="bg-surface rounded-card p-[28px] shadow-[var(--card-shadow)]">
          <h1 className="text-[22px] font-medium mb-1 tracking-[-0.015em]">Welcome back</h1>
          <p className="text-[13px] text-text-secondary mb-[22px]">
            Log in to keep tailoring your resume.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
            {error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div>
              <label className="block text-[12px] mb-[5px] text-text-secondary" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full min-h-[36px] px-[10px] py-[6px] text-[14px] text-text-primary bg-bg border border-border-hairline rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] mb-[5px] text-text-secondary" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[36px] px-[10px] py-[6px] text-[14px] text-text-primary bg-bg border border-border-hairline rounded-lg outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex items-center justify-center gap-[6px] w-full px-4 py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="text-[13px] text-text-secondary mt-[18px] text-left">
            New here?{" "}
            <a href="/signup" className="text-accent no-underline">
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

1. Visit `http://localhost:3000/login` in dark mode (default if OS is dark, or toggle via `ThemeToggle`).
2. **Verify:** page background is near-black-blue (`#161826`), card is a lighter surface (`#232532`) with a subtle border+shadow, "Tailor" in the wordmark and the "Log in" button border/text are the purple accent.
3. Toggle to light mode via `ThemeToggle`.
4. **Verify:** page background is white, card is a very light lavender-gray (`#f4f3fa`), text is dark, accent purple stays the same on the button/link/wordmark.
5. Submit with an invalid email/password.
6. **Verify:** red error banner appears above the fields in both themes, layout doesn't shift oddly.
7. Submit valid credentials (an existing test user, or sign up first via `/signup`).
8. **Verify:** redirects to `/`.
9. Click "Create an account".
10. **Verify:** navigates to `/signup`.
11. Resize the browser to ~375px wide.
12. **Verify:** no horizontal scrollbar, card padding stays usable.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: restyle login screen with redesign tokens"
```

---

### Task 3: Restyle the Signup screen

**Files:**
- Modify: `app/signup/page.tsx`

**Interfaces:**
- Consumes: same Tailwind utilities as Task 2; `useAuth().signup` (unchanged, `(email: string, password: string) => Promise<void>`).
- Produces: no new exports — page component routed at `/signup`.

- [ ] **Step 1: Replace the contents of `app/signup/page.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function SignupPage() {
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signup(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary relative flex items-center p-[6vw] pl-[clamp(24px,8vw,120px)]">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-[380px] flex flex-col gap-[26px]">
        <div className="text-[19px] font-medium tracking-[-0.015em]">
          Resume<span className="text-accent">Tailor</span>
        </div>

        <div className="bg-surface rounded-card p-[28px] shadow-[var(--card-shadow)]">
          <h1 className="text-[22px] font-medium mb-1 tracking-[-0.015em]">Create your account</h1>
          <p className="text-[13px] text-text-secondary mb-[22px]">
            Takes about a minute — no credit card.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
            {error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-900 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div>
              <label className="block text-[12px] mb-[5px] text-text-secondary" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full min-h-[36px] px-[10px] py-[6px] text-[14px] text-text-primary bg-bg border border-border-hairline rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] mb-[5px] text-text-secondary" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[36px] px-[10px] py-[6px] text-[14px] text-text-primary bg-bg border border-border-hairline rounded-lg outline-none"
              />
              <p className="text-xs text-text-secondary mt-1">At least 8 characters.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex items-center justify-center gap-[6px] w-full px-4 py-[9px] border border-accent rounded-lg bg-transparent text-accent text-sm font-medium cursor-pointer disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-[13px] text-text-secondary mt-[18px] text-left">
            Already have an account?{" "}
            <a href="/login" className="text-accent no-underline">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

Note: no "Full name" field — matches the existing `signup(email, password)` contract (see Global Constraints).

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

1. Visit `http://localhost:3000/signup` in dark mode.
2. **Verify:** same visual language as the restyled login screen (card, tokens, outlined button), title "Create your account", subtitle "Takes about a minute — no credit card.", only Email + Password fields, password hint below the password field.
3. Toggle light mode, confirm the light palette matches Task 2's light-mode verification.
4. Submit with a password under 8 characters.
5. **Verify:** browser's native `minLength` validation blocks submission (no change from prior behavior).
6. Submit with a new, valid email/password.
7. **Verify:** account is created and the app redirects to `/`.
8. Click "Log in" link.
9. **Verify:** navigates to `/login`.

- [ ] **Step 3: Commit**

```bash
git add app/signup/page.tsx
git commit -m "feat: restyle signup screen with redesign tokens"
```
