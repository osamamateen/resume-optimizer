# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Next.js dev server (uses Webpack)
npm run build     # Production build (uses Webpack)
npm run start     # Start production server
npm run lint      # Run ESLint
```

The `--webpack` flag is intentional; the app uses `@react-pdf/renderer` which does not bundle cleanly with Turbopack.

To run the DOCX parsing/rewriting spike independently:

```bash
cd spike
node rewrite.js   # round-trips all fixtures through the fake optimizer
node validate.js  # validates fixture round-trips
```

## Environment Variables

Copy `.env.local` and fill in real values:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for Claude) | — | Anthropic API key |
| `AI_PROVIDER` | No | `claude` | `claude` or `openrouter` |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-6` | Model used by ClaudeProvider |
| `OPENROUTER_API_KEY` | Yes (for OpenRouter) | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `meta-llama/llama-3.3-70b-instruct:free` | Model used by OpenRouterProvider |
| `DATABASE_URL` | Yes | — | Postgres connection string (Prisma) |
| `JWT_ACCESS_SECRET` | Yes | — | Signs/verifies access tokens |
| `JWT_REFRESH_HASH_SECRET` | Yes | — | Pepper mixed into the refresh-token hash before storage |

## Architecture

### Request flow

1. Logging in lands on the applications dashboard (`app/page.tsx`),
   listing the user's saved applications and showing their master resume
   status (`components/MasterResumeControl.tsx`).
2. "New application" starts a 3-step flow at `app/applications/new/page.tsx`:
   company/role (`components/ApplicationDetailsStep.tsx`), resume source
   — master resume reuse or a one-off override upload
   (`components/ResumeSourceStep.tsx`) — then job description
   (`components/JobDescriptionStep.tsx`, unchanged).
3. The browser POSTs `multipart/form-data` to `POST /api/optimize`
   (`app/api/optimize/route.ts`): `companyName`, `roleTitle`,
   `jobDescription`, `useMaster`, and either `resume` (override upload)
   or nothing (server loads the stored `MasterResume`).
4. The route parses the resume into `ResumeSection[]`, calls
   `getAiProvider().optimizeResume(...)`, and on success persists an
   `Application` row (company/role/job description/`resumeData`/score/
   keywords/summary — no file) before returning the result plus its new
   `applicationId`.
5. The browser redirects to `/applications/:id`
   (`app/applications/[id]/page.tsx`), which fetches the saved record via
   `GET /api/applications/:id` and renders it with the existing
   `ResultView` component.
6. Downloads are unchanged: `ResultView` posts `resumeData` +
   `templateId` to `POST /api/resume/render`, which renders a PDF from
   scratch every time — nothing is ever stored as rendered bytes.

### Key modules

**Parsing**
- `lib/parsing/docx.ts` — parses `word/document.xml` into an XML AST with `fast-xml-parser` (`preserveOrder:true`). Extracts text segments by splitting paragraphs at `<w:tab>`/`<w:br>` boundaries and flattening pass-through wrapper tags (`w:hyperlink`, `w:ins`, `w:del`, `w:smartTag`). `rewriteDocx` mutates the first `<w:t>` node in each segment and blanks the rest, then re-serializes.
- `lib/parsing/pdf.ts` — text extraction only via `pdf-parse`; PDFs cannot be edited in-place.
- `lib/parsing/extractSections.ts` — assigns a `heading` context to every segment using `looksLikeHeading()` (known heading names + all-caps short-text heuristic). The heading field is provided to the AI for context and is used by the clean-template renderers for styling.

**AI providers** (`lib/ai/providers/`)
- `claude.ts` — Anthropic SDK with `output_config.format.type = "json_schema"` (structured output). `buildOutputSchema()` strips unsupported `minimum`/`maximum` constraints from the Zod-generated JSON Schema.
- `openrouter.ts` — plain `fetch` to OpenRouter's OpenAI-compatible chat endpoint with `response_format: { type: "json_object" }` and an explicit JSON-shape instruction in the system prompt.

**Rendering** (`lib/render/`)
- `pdfTemplate.tsx` — React component rendered to PDF buffer via `@react-pdf/renderer`. No Chromium needed; works in serverless/edge.
- `docxTemplate.ts` — builds a document from scratch using the `docx` library with heading/paragraph hierarchy from `looksLikeHeading`.

**UI components** (`components/`)
- `ApplicationDetailsStep` — company/role title inputs (first step of
  the new-application flow).
- `ResumeSourceStep` — choose the master resume or upload a one-off
  override for a single application.
- `MasterResumeControl` — dashboard widget showing/replacing the user's
  master resume.
- `JobDescriptionStep` — textarea for the job posting.
- `ResultView` — shows ATS score, keyword lists, change summary, and download buttons.
- `LoadingView` — animated progress bar (caps at 88%) with cycling status messages shown during the `/api/optimize` call.
- `resume/TemplateSelector` — two-column grid picker for output template style (modern, minimal); fetches options from `GET /api/templates`.

**API routes** (`app/api/`)
- `POST /api/optimize` — main resume optimization endpoint (see request flow above).
- `GET /api/templates` — returns available template options from `lib/templates/registry`.
- `POST /api/resume/render` — accepts `{ resumeData, templateId }`, validates with `ResumeDataSchema`, and returns a rendered PDF via `lib/services/pdf-renderer.service`.

### Authentication

Every API route (`/api/optimize`, `/api/resume/render`, `/api/templates`)
requires a valid access token, checked by `requireAuth()`
(`lib/auth/requireAuth.ts`) as the first statement of each handler. A
missing/invalid/expired token always returns
`{ "error": "Unauthorized" }` with status 401, regardless of the specific
reason.

- `prisma/schema.prisma` — `User` (email + bcrypt password hash) and
  `RefreshToken` (hashed, rotated, revocable) models, via `lib/prisma.ts`
  (a `PrismaClient` singleton, to survive `next dev` hot reloads without
  exhausting DB connections).
- `lib/auth/passwords.ts` — bcrypt hash/verify.
- `lib/auth/tokens.ts` — signs/verifies the access token: a `jose` JWT,
  15 minute TTL, payload `{ sub: userId }`.
- `lib/auth/refreshTokens.ts` — issues/rotates/revokes the refresh token:
  an opaque random string, 7 day TTL, stored only as an HMAC hash
  (`JWT_REFRESH_HASH_SECRET` pepper). Every use rotates it; reuse of an
  already-rotated token revokes all of that user's refresh tokens
  (theft/replay signal).
- `app/api/auth/{signup,login,refresh,logout}/route.ts` — the public auth
  endpoints.
- `lib/auth/AuthContext.tsx` + `lib/auth/tokenStorage.ts` — client-side
  auth state, persisted in `localStorage`.
- `lib/auth/authFetch.ts` — `fetch` wrapper used everywhere the app calls
  a protected API route; attaches the access token, and on a 401
  transparently calls `/api/auth/refresh` and retries once before
  redirecting to `/login`.
- `app/page.tsx` redirects to `/login` when there's no session (checked
  client-side via `AuthContext`, since tokens live in `localStorage`, not
  cookies — there is no server-side session to check during SSR).

**Prisma is pinned to `6.19.3`.** Prisma 7 removed `datasource.url`
support in `schema.prisma` in favor of a `prisma.config.ts` +
driver-adapter setup; this project still uses the classic
`url = env("DATABASE_URL")` form, so don't bump `prisma`/`@prisma/client`
past the 6.x line without migrating the config approach too.

If the Postgres provider's direct connection host resolves to an
IPv6-only address (true for new Supabase projects without the IPv4
add-on) and the network can't route IPv6, use the provider's connection
pooler instead. For Supabase specifically, use the **session pooler**
(port 5432) for `DATABASE_URL` — the transaction-mode pooler (port 6543)
doesn't support the advisory locks `prisma migrate` needs and will hang.

### Job applications and the master resume

- `prisma/schema.prisma` — `MasterResume` (one per user, stores the
  original uploaded file's bytes so it can be re-parsed for a future
  application) and `Application` (company, role, job description, and
  the AI's structured output — no file) models.
- `app/api/master-resume/route.ts` — `GET` (metadata only) / `POST`
  (upload or replace) the user's master resume.
- `app/api/applications/route.ts`, `app/api/applications/[id]/route.ts`
  — list / detail / delete a user's saved applications.
- `lib/hooks/useMasterResume.ts` — shared client hook used by both the
  dashboard's `MasterResumeControl` and the new-application flow's
  `ResumeSourceStep` to know whether a master resume already exists.
- Replacing the master resume never touches past `Application` rows —
  each one already has its own frozen `resumeData` snapshot from when it
  was created.

### `spike/` directory

Standalone Node.js scripts (CommonJS) used during initial development to validate the DOCX round-trip strategy. Not imported by the Next.js app. Has its own `package.json` with a separate install.
