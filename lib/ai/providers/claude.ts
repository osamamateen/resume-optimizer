import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AiProvider, OptimizeRequest, OptimizationResult } from "../types";
import { optimizationResultSchema } from "../types";
import { ResumeDataSchema } from "../../../types/resume.types";
import type { ResumeData } from "../../../types/resume.types";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an expert resume editor specializing in ATS (Applicant Tracking System) optimization.
You will be given a resume broken into text sections (each with an id) and a target job description.
Rewrite each section's text to better align with the job description's language, keywords, and requirements.

Rules:
- Never fabricate experience, employers, dates, degrees, or skills the candidate doesn't have.
- Keep each rewritten section roughly the same length as the original — you are reframing, not expanding.
- Preserve names, contact info, dates, and section headings essentially as written.
- Return optimizedText for every section id you were given, even if unchanged.
- Estimate an ATS match score (0-100) for the optimized resume against the job description, and list matched and missing keywords.`;

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

function buildOutputSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(optimizationResultSchema) as Record<string, unknown>;
  delete schema.$schema;
  return stripUnsupportedConstraints(schema) as Record<string, unknown>;
}

export class ClaudeProvider implements AiProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async optimizeResume(request: OptimizeRequest): Promise<OptimizationResult> {
    const userContent = JSON.stringify({
      jobDescription: request.jobDescription,
      sections: request.sections,
    });

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      output_config: {
        format: { type: "json_schema", schema: buildOutputSchema() },
      },
      messages: [{ role: "user", content: userContent }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude did not return a text block with the optimization result");
    }

    return optimizationResultSchema.parse(JSON.parse(textBlock.text));
  }

  async extractStructuredResume(
    optimizedSections: Array<{ id: string; optimizedText: string }>
  ): Promise<ResumeData> {
    const extractionSchema = z.toJSONSchema(ResumeDataSchema) as Record<string, unknown>;
    delete (extractionSchema as Record<string, unknown>).$schema;
    const cleanSchema = stripUnsupportedConstraints(extractionSchema) as Record<string, unknown>;

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: `You are a resume parser. Extract structured information from the provided resume text segments and return it as JSON.

Rules:
- Contact info (name, email, phone, location, optional: linkedin/github/website) comes from the opening segments
- Extract each job as an experience entry: title, company, location, startDate, endDate, and an array of bullet strings (strip bullet symbols)
- Extract each education entry: institution, degree, field, graduationDate
- If projects exist, extract them with name, description, technologies array, and bullets array
- If a skills section exists, classify into languages, frameworks, tools, other (each an array of strings)
- If any other section exists that doesn't fit the schema, add it as a customSections entry with label and content
- Dates should be kept as written (e.g. "Jan 2020", "2019 – Present")
- Omit optional fields rather than returning empty strings`,
      output_config: {
        format: { type: "json_schema", schema: cleanSchema },
      },
      messages: [{ role: "user", content: JSON.stringify(optimizedSections) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Claude did not return a text block with the extraction result");
    }

    return ResumeDataSchema.parse(JSON.parse(textBlock.text));
  }
}
