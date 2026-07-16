# Resume Optimizer

A Next.js app that tailors a resume to a specific job description using an LLM (Claude or OpenRouter), then hands back an updated resume as a PDF and/or DOCX.

## How it works

1. Upload a `.docx` or `.pdf` resume and paste a job description in the 3-step UI.
2. The file is parsed into sections (heading + text per segment).
3. The configured AI provider rewrites each section, and returns an ATS score, keyword lists, and a summary of changes.
4. Depending on the selected mode:
   - **In-place** (DOCX only): the original document's XML is mutated in place, preserving its original formatting.
   - **Template**: a new PDF/DOCX is generated from scratch using a clean template.
5. The result is offered back as a download.

See [CLAUDE.md](CLAUDE.md) for a detailed architecture breakdown.

## Authentication

Every API route requires a valid access token. Users sign up / log in with
email and password (`/signup`, `/login`); the server returns a short-lived
JWT access token plus a longer-lived opaque refresh token. The browser
attaches the access token as `Authorization: Bearer <token>` on every API
call and transparently refreshes it when it expires. See "Authentication"
in [CLAUDE.md](CLAUDE.md) for details.

## Getting started

```bash
npm install
cp .env.local.example .env.local   # then fill in your API key(s)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for Claude) | — | Anthropic API key |
| `AI_PROVIDER` | No | `claude` | `claude` or `openrouter` |
| `CLAUDE_MODEL` | No | `claude-sonnet-4-6` | Model used by ClaudeProvider |
| `OPENROUTER_API_KEY` | Yes (for OpenRouter) | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `meta-llama/llama-3.3-70b-instruct:free` | Model used by OpenRouterProvider |
| `DATABASE_URL` | Yes | — | Postgres connection string (Prisma). Use a pooled connection if the direct host is IPv6-only on your network (e.g. Supabase's Session/Transaction pooler) |
| `JWT_ACCESS_SECRET` | Yes | — | Signs/verifies access tokens |
| `JWT_REFRESH_HASH_SECRET` | Yes | — | Pepper mixed into the refresh-token hash before storage |

## Scripts

```bash
npm run dev     # Start Next.js dev server (Webpack)
npm run build   # Production build (Webpack)
npm run start   # Start production server
npm run lint    # Run ESLint
```

The Webpack flag is intentional — the app depends on packages that don't bundle cleanly with Turbopack.

## `spike/`

Standalone Node.js scripts used to validate the DOCX round-trip strategy independently of the Next.js app:

```bash
cd spike
node rewrite.js   # round-trips all fixtures through the fake optimizer
node validate.js  # validates fixture round-trips
```
