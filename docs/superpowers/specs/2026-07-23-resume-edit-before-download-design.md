# Resume edit before download — design

## Problem

After `POST /api/optimize` produces a rewritten resume, the user can only
review it (score, keywords, summary of changes) and download it as-is.
There's no way to tweak the AI's output — fix a wrong detail, adjust
wording, add/remove a bullet — before generating the PDF.

## Goal

Let the user edit the optimized resume's structured data
(`Application.resumeData`) on a dedicated screen, save those edits, and
then download a PDF that reflects them.

## Flow

1. User is on `/applications/[id]` viewing `ResultView` (score, keyword
   lists, summary of changes, template picker, download button) — this
   view is unchanged except for one addition: an **"Edit resume"**
   button.
2. Clicking it navigates to `/applications/[id]/edit`.
3. That page loads the application (same `GET /api/applications/:id`
   used today) and renders `ResumeEditor`, seeded from
   `application.resumeData`.
   - If `resumeData` is `null` (resume hasn't been optimized yet),
     redirect back to `/applications/[id]` — there's nothing to edit.
4. User edits fields. **Save** sends the edited `ResumeData` to
   `PATCH /api/applications/[id]`, then routes back to
   `/applications/[id]`. **Cancel** routes back without saving.
5. Back on `/applications/[id]`, the page re-fetches and `ResultView`
   renders with the updated `resumeData`. Download works exactly as
   before — it already just POSTs whatever `resumeData` it's holding to
   `/api/resume/render`.

Score, matched/missing keywords, and summary-of-changes are **not**
recomputed from edits — they stay frozen as the AI produced them. Only
`resumeData` changes.

## API change

`app/api/applications/[id]/route.ts` gets a new `PATCH` handler
alongside the existing `GET`/`DELETE`:

- `requireAuth()` first (same pattern as every route in this app) → 401
  on failure.
- Load the application via the existing `loadOwnedApplication(id,
  userId)` helper → 404 if missing or not owned by the caller.
- 409 if `application.resumeData` is currently `null` — can't edit a
  resume that was never optimized.
- Body: `{ resumeData: unknown }`. Validate with the existing
  `ResumeDataSchema.safeParse` (same pattern already used in
  `app/api/resume/render/route.ts`) → 400 with `parsed.error.format()`
  on failure.
- On success: `prisma.application.update({ where: { id }, data: {
  resumeData: parsed.data } })`, then return the same JSON shape `GET`
  returns, so the client can reuse one response handler for both.

## UI

### `app/applications/[id]/edit/page.tsx`

Client component. Fetches the application via `GET
/api/applications/:id` (mirrors the existing detail page's fetch
pattern), guards on `resumeData === null` as described above, and
renders `ResumeEditor` with `initialData={application.resumeData}`,
`onSave` (does the `PATCH`, then `router.push` to the detail page), and
`onCancel` (`router.push` to the detail page without saving).

### `components/resume/ResumeEditor.tsx`

Holds the full `ResumeData` object in local state (`useState`), edited
immutably through small per-field update helpers. Sections:

- **Contact** — plain text inputs: name, email, phone, location,
  linkedin, github, website (last three optional).
- **Summary** — one textarea.
- **Experience** — list of entries (title, company, location,
  startDate, endDate, bullets), via `ListEditor`.
- **Education** — list of entries (institution, degree, field,
  graduationDate), via `ListEditor`.
- **Projects** (optional section) — list of entries (name, description,
  technologies, bullets), via `ListEditor`. Technologies is a
  `TagListEditor`.
- **Skills** (optional section) — four `TagListEditor`s: languages,
  frameworks, tools, other.
- **Custom sections** (optional) — list of entries (label, content), via
  `ListEditor`.

Bullets within experience/project entries are `TagListEditor`s.

Footer: **Save** (disabled while saving; shows an inline error message
on `PATCH` failure, matching the existing `downloadError` pattern in
`ResultView`) and **Cancel**.

### `components/resume/ListEditor.tsx`

Generic reusable list editor for arrays of objects (used by Experience,
Education, Projects, Custom sections). Renders one card per entry with
its fields (passed as children/render-prop), plus per-entry controls:
**Remove**, **move up**, **move down**; and a global **Add** button that
appends a blank entry (empty-string/empty-array fields) to the end.

### `components/resume/TagListEditor.tsx`

Generic editor for a `string[]` (used for bullets and skills
categories, and project technologies). A text input where Enter (or a
small "Add" button) appends a non-empty trimmed string as a chip; each
chip has a `×` to remove it. No reordering — not worth the added UI
complexity for this use case.

## Validation & error handling

No validation beyond what `ResumeDataSchema` already enforces (e.g.
empty strings pass) — this matches how the app already treats
AI-generated data elsewhere; there's no need to be stricter for
human-edited data. `PATCH` failures surface as an inline error on the
edit screen; the user's in-progress edits are not lost (state stays in
the component, only the save attempt failed).

## Out of scope

- Recomputing ATS score/keywords after edits.
- Reordering bullets or skills within a category.
- Autosave / unsaved-changes warning on navigation away.
- Concurrent-edit conflict handling (last write wins, same as the rest
  of this app's mutation endpoints).

## Testing

No test runner in this repo — verify manually: optimize an application,
click "Edit resume," edit a mix of scalar fields and list entries
(add/remove/reorder an experience entry, add/remove a bullet, edit
skills), Save, confirm the detail page shows the edits and the
downloaded PDF reflects them. Also verify Cancel discards changes, and
that hitting `/applications/[id]/edit` directly for an application still
in "scored" state (no `resumeData`) redirects back.
