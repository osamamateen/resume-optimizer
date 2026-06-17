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

## Architecture

### Request flow

1. User uploads a `.docx` or `.pdf` resume and pastes a job description in the 3-step UI (`app/page.tsx`).
2. The browser POSTs `multipart/form-data` to `POST /api/optimize` (`app/api/optimize/route.ts`).
3. The route parses the file into `ResumeSection[]` (id + heading + originalText per segment).
4. `getAiProvider()` (`lib/ai/provider.ts`) selects a provider based on `AI_PROVIDER` env var and calls `optimizeResume({ sections, jobDescription })`.
5. The AI returns `optimizedText` for every section id, plus an ATS score and keyword lists.
6. Depending on `mode`:
   - **`in-place`** (DOCX only): the original XML AST is mutated and re-zipped.
   - **`template`** (any format): a new PDF and DOCX are generated from scratch.
7. The API returns base64-encoded file(s) plus score/keywords/summary; the browser decodes and offers downloads.

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
- `UploadStep` — dropzone for the file and mode selector (in-place vs template).
- `JobDescriptionStep` — textarea for the job posting.
- `ResultView` — shows ATS score, keyword lists, change summary, and download buttons.

### `spike/` directory

Standalone Node.js scripts (CommonJS) used during initial development to validate the DOCX round-trip strategy. Not imported by the Next.js app. Has its own `package.json` with a separate install.
