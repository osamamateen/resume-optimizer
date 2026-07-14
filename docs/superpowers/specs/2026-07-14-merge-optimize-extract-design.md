# Merge optimizeResume + extractStructuredResume into one call

## Problem

`POST /api/optimize` currently makes two sequential AI calls: `optimizeResume`
(~60s) followed by `extractStructuredResume` (~40s), which depends on
`optimizeResume`'s output. Users wait ~100s total with only a fake progress
bar (`LoadingView`) for feedback.

`extractStructuredResume` re-parses text the model itself just produced in
the first call, so the second round trip is largely redundant latency.

## Goal

Cut the wait for the Claude provider by folding both steps into a single
model call. Leave the OpenRouter provider's two-call flow untouched
internally, but give both providers the same external interface so
`route.ts` doesn't need to know which provider is doing one call vs. two.

## Scope

- `lib/ai/types.ts` — extend `optimizationResultSchema`, shrink `AiProvider`
  interface.
- `lib/ai/providers/claude.ts` — merge the two calls into one.
- `lib/ai/providers/openrouter.ts` — keep two internal fetches, but expose
  them through the same single-method interface.
- `app/api/optimize/route.ts` — simplify to one call.

Out of scope: OpenRouter latency (unchanged), `LoadingView` UX (unchanged),
DOCX/PDF parsing (unchanged).

## Design

### Types (`lib/ai/types.ts`)

`optimizationResultSchema` gains a `resumeData: ResumeDataSchema` field.
`AiProvider` drops `extractStructuredResume` from its public signature —
`optimizeResume` is the only method callers need.

```ts
export const optimizationResultSchema = z.object({
  sections: z.array(z.object({ id: z.string(), optimizedText: z.string() })),
  atsScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  summaryOfChanges: z.object({
    headline: z.string(),
    bullets: z.array(z.string()),
  }),
  resumeData: ResumeDataSchema,
});

export interface AiProvider {
  optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>;
}
```

### ClaudeProvider (`lib/ai/providers/claude.ts`)

One `messages.create` call instead of two:

- Output schema: the existing `buildOutputSchema()`/
  `stripUnsupportedConstraints()` pipeline runs over the new
  `optimizationResultSchema` (which now includes `resumeData`), replacing
  the separate extraction schema.
- System prompt: merge the rewrite rules (from the current
  `SYSTEM_PROMPT`) with the extraction rules (from the current
  `extractStructuredResume`'s system prompt) into one prompt covering both
  tasks.
- `max_tokens`: raise from 8000 to 12000 to cover the combined response
  (rewritten sections + score/keywords + full structured resume).
- The old `extractStructuredResume` method is deleted from this class.

### OpenRouterProvider (`lib/ai/providers/openrouter.ts`)

No latency change — still two fetches — but the shape changes to match the
new interface:

- `extractStructuredResume` becomes a private method (not part of
  `AiProvider`).
- Public `optimizeResume` calls the existing rewrite fetch, then internally
  calls the private extraction method with the rewritten sections, and
  returns a merged object with `resumeData` attached.

### route.ts

Collapses to a single call and a single try/catch:

```ts
const ai = getAiProvider();
let result;
console.time("Optimizing resume with AI");
try {
  result = await ai.optimizeResume({ sections, jobDescription });
} catch (err) {
  console.error("AI optimization failed", err);
  return NextResponse.json({ error: "Resume optimization failed. Please try again." }, { status: 502 });
}
console.timeEnd("Optimizing resume with AI");

return NextResponse.json({
  atsScore: result.atsScore,
  matchedKeywords: result.matchedKeywords,
  missingKeywords: result.missingKeywords,
  summaryOfChanges: result.summaryOfChanges,
  resumeData: result.resumeData,
});
```

### Error handling

Only one error path remains in `route.ts`, returning the existing generic
502 message regardless of which internal stage failed. No debugging detail
is lost: whatever `Error` a provider throws (including, for OpenRouter,
whichever of its two internal fetches failed) is still logged in full via
`console.error(err)` before the generic response goes out.

## Testing

No automated tests currently cover this path. Verification is manual:

1. Run the dev server, optimize a `.docx` resume, confirm `atsScore`,
   keyword lists, `summaryOfChanges`, and `resumeData` all populate
   correctly and match the source content.
2. Repeat with a `.pdf` resume.
3. Compare the `console.time("Optimizing resume with AI")` output
   before/after to confirm the Claude path is meaningfully faster than the
   previous ~100s two-call total.
4. Confirm `AI_PROVIDER=openrouter` still works end-to-end (unchanged
   latency, same output shape).
