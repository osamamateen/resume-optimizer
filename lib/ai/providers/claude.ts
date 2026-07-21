import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AiProvider, OptimizeRequest, OptimizationResult, ScoreResult } from "../types";
import { optimizationResultSchema, scoreResultSchema } from "../types";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an expert resume editor specializing in ATS (Applicant Tracking System) optimization.
You will be given a resume broken into text sections (each with an id) and a target job description.

Rewrite the resume to better align with the job description's language, keywords, and requirements, and emit the result directly as the structured resumeData shape below. Do not return a separate flat per-section representation — resumeData is the only place the rewritten text should appear.

Rewriting rules:
- Never fabricate experience, employers, dates, degrees, or skills the candidate doesn't have.
- Keep rewritten content roughly the same length as the original — you are reframing, not expanding.
- Preserve names, contact info, and dates essentially as written.
- Estimate an ATS match score (0-100) for the optimized resume against the job description, and list matched and missing keywords.

resumeData shape rules:
- Contact info (name, email, phone, location, optional: linkedin/github/website) comes from the opening segments
- Extract each job as an experience entry: title, company, location, startDate, endDate, and an array of bullet strings (strip bullet symbols)
- Extract each education entry: institution, degree, field, graduationDate
- If projects exist, extract them with name, description, technologies array, and bullets array
- Do not write more than 7 bullets per section.
- If a skills section exists, classify into languages, frameworks, tools, other (each an array of strings)
- If any other section exists that doesn't fit the schema, add it as a customSections entry with label and content
- Dates should be kept as written (e.g. "Jan 2020", "2019 – Present")
- Omit optional fields rather than returning empty strings`;

const SCORE_SYSTEM_PROMPT = `You are an expert resume reviewer specializing in ATS (Applicant Tracking System) compatibility.
You will be given a resume broken into text sections (each with an id) and a target job description.

Do NOT rewrite or edit the resume. Only evaluate it exactly as given.

1. Estimate an ATS match score (0-100) for the resume exactly as written against the job description.
2. List keywords from the job description the resume already matches, and keywords it's missing.
3. Suggest concrete improvements the candidate could make — a short headline plus specific bullet points (e.g. keywords to work in, weak phrasing to strengthen, missing quantifiable results). Never suggest inventing experience or skills the candidate doesn't have — suggestions are about how they present what they already have.`;

function stripUnsupportedConstraints(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripUnsupportedConstraints);
  if (node !== null && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (obj.type === "number" && (k === "minimum" || k === "maximum")) continue;
      result[k] = stripUnsupportedConstraints(v);
    }
    return result;
  }
  return node;
}

function buildOutputSchema(zodSchema: z.ZodTypeAny): Record<string, unknown> {
  const schema = z.toJSONSchema(zodSchema) as Record<string, unknown>;
  delete schema.$schema;
  return stripUnsupportedConstraints(schema) as Record<string, unknown>;
}

export class ClaudeProvider implements AiProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async optimizeResume(request: OptimizeRequest): Promise<OptimizationResult> {
    const overallStart = performance.now();

    const userContent = JSON.stringify({
      jobDescription: request.jobDescription,
      sections: request.sections,
    });

    console.log("[Claude][Optimize] Starting request");
    console.log({
      model: MODEL,
      jobDescriptionChars: request.jobDescription.length,
      sections: request.sections.length,
      payloadChars: userContent.length,
    });

    const llmStart = performance.now();

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 10000,
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: buildOutputSchema(optimizationResultSchema),
        },
      },
      messages: [{ role: "user", content: userContent }],
    });

    const llmTime = performance.now() - llmStart;

    console.log("[Claude][Optimize] Response received");
    console.log({
      llmTimeMs: Math.round(llmTime),
      stopReason: response.stop_reason,
      usage: response.usage,
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "Claude's response was truncated (hit max_tokens) before completing the optimization result"
      );
    }

    const parseStart = performance.now();

    const textBlock = response.content.find(
      (block) => block.type === "text"
    );

    if (!textBlock || textBlock.type !== "text") {
      throw new Error(
        "Claude did not return a text block with the optimization result"
      );
    }

    const parsed = optimizationResultSchema.parse(
      JSON.parse(textBlock.text)
    );

    const parseTime = performance.now() - parseStart;
    const totalTime = performance.now() - overallStart;

    console.log("[Claude][Optimize] Complete");
    console.log({
      parseTimeMs: Math.round(parseTime),
      totalTimeMs: Math.round(totalTime),
    });

    return parsed;
  }

  async scoreResume(request: OptimizeRequest): Promise<ScoreResult> {
    const overallStart = performance.now();

    const userContent = JSON.stringify({
      jobDescription: request.jobDescription,
      sections: request.sections,
    });

    console.log("[Claude][Score] Starting request");
    console.log({
      model: MODEL,
      jobDescriptionChars: request.jobDescription.length,
      sections: request.sections.length,
      payloadChars: userContent.length,
    });

    const llmStart = performance.now();

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SCORE_SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: buildOutputSchema(scoreResultSchema),
        },
      },
      messages: [{ role: "user", content: userContent }],
    });

    const llmTime = performance.now() - llmStart;

    console.log("[Claude][Score] Response received");
    console.log({
      llmTimeMs: Math.round(llmTime),
      stopReason: response.stop_reason,
      usage: response.usage,
    });

    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "Claude's response was truncated (hit max_tokens) before completing the score result"
      );
    }

    const parseStart = performance.now();

    const textBlock = response.content.find(
      (block) => block.type === "text"
    );

    if (!textBlock || textBlock.type !== "text") {
      throw new Error(
        "Claude did not return a text block with the score result"
      );
    }

    const parsed = scoreResultSchema.parse(
      JSON.parse(textBlock.text)
    );

    const parseTime = performance.now() - parseStart;
    const totalTime = performance.now() - overallStart;

    console.log("[Claude][Score] Complete");
    console.log({
      parseTimeMs: Math.round(parseTime),
      totalTimeMs: Math.round(totalTime),
    });

    return parsed;
  }
}