import type { AiProvider, OptimizeRequest, OptimizationResult, ScoreResult } from "../types";
import { optimizationResultSchema, scoreResultSchema } from "../types";
import { ResumeDataSchema } from "../../../types/resume.types";
import type { ResumeData } from "../../../types/resume.types";

const BASE_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

const SYSTEM_PROMPT = `You are an expert resume editor specializing in ATS (Applicant Tracking System) optimization.
You will be given a resume broken into text sections (each with an id) and a target job description.
Rewrite each section's text to better align with the job description's language, keywords, and requirements.

Rules:
- Never fabricate experience, employers, dates, degrees, or skills the candidate doesn't have.
- Keep each rewritten section roughly the same length as the original — you are reframing, not expanding.
- Preserve names, contact info, dates, and section headings essentially as written.
- Return optimizedText for every section id you were given, even if unchanged.
- Estimate an ATS match score (0-100) for the optimized resume against the job description, and list matched and missing keywords.

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.
The JSON must match this exact structure:
{
  "sections": [{ "id": "string", "optimizedText": "string" }],
  "atsScore": number (0-100),
  "matchedKeywords": ["string"],
  "missingKeywords": ["string"],
  "summaryOfChanges": { "headline": "string", "bullets": ["string"] }
}`;

const SCORE_SYSTEM_PROMPT = `You are an expert resume reviewer specializing in ATS (Applicant Tracking System) compatibility.
You will be given a resume broken into text sections (each with an id) and a target job description.

Do NOT rewrite or edit the resume. Only evaluate it exactly as given.

1. Estimate an ATS match score (0-100) for the resume exactly as written against the job description.
2. List keywords from the job description the resume already matches, and keywords it's missing.
3. Suggest concrete improvements the candidate could make — a short headline plus specific bullet points (e.g. keywords to work in, weak phrasing to strengthen, missing quantifiable results). Never suggest inventing experience or skills the candidate doesn't have — suggestions are about how they present what they already have.

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.
The JSON must match this exact structure:
{
  "atsScore": number (0-100),
  "matchedKeywords": ["string"],
  "missingKeywords": ["string"],
  "suggestions": { "headline": "string", "bullets": ["string"] }
}`;

const rewriteResultSchema = optimizationResultSchema.omit({ resumeData: true });

export class OpenRouterProvider implements AiProvider {
  private apiKey: string;

  constructor() {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY environment variable is not set");
    this.apiKey = key;
  }

  async optimizeResume(request: OptimizeRequest): Promise<OptimizationResult> {
    const userContent = JSON.stringify({
      jobDescription: request.jobDescription,
      sections: request.sections,
    });

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Resume Optimizer",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${body}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response");

    const rewritten = rewriteResultSchema.parse(JSON.parse(content));
    const resumeData = await this.extractStructuredResume(rewritten.sections);

    return { ...rewritten, resumeData };
  }

  async scoreResume(request: OptimizeRequest): Promise<ScoreResult> {
    const userContent = JSON.stringify({
      jobDescription: request.jobDescription,
      sections: request.sections,
    });

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Resume Optimizer",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SCORE_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${body}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response");

    return scoreResultSchema.parse(JSON.parse(content));
  }

  private async extractStructuredResume(
    optimizedSections: Array<{ id: string; optimizedText: string }>
  ): Promise<ResumeData> {
    const extractionSystemPrompt = `You are a resume parser. Extract structured information from the provided resume text segments and return it as JSON.

Rules:
- Contact info (name, email, phone, location, optional: linkedin/github/website) comes from the opening segments
- Extract each job as an experience entry: title, company, location, startDate, endDate, and an array of bullet strings (strip bullet symbols)
- Extract each education entry: institution, degree, field, graduationDate
- If projects exist, extract them with name, description, technologies array, and bullets array
- If a skills section exists, classify into languages, frameworks, tools, other (each an array of strings)
- If any other section exists that doesn't fit the schema, add it as a customSections entry with label and content
- Dates should be kept as written (e.g. "Jan 2020", "2019 – Present")
- Omit optional fields rather than returning empty strings

You MUST respond with valid JSON only — no markdown, no code fences, no extra text.
The JSON must match this exact structure:
{
  "contact": { "name": "string", "email": "string", "phone": "string", "location": "string", "linkedin": "string (optional)", "github": "string (optional)", "website": "string (optional)" },
  "summary": "string (optional)",
  "experience": [{ "title": "string", "company": "string", "location": "string (optional)", "startDate": "string", "endDate": "string", "bullets": ["string"] }],
  "education": [{ "institution": "string", "degree": "string", "field": "string (optional)", "graduationDate": "string" }],
  "projects": [{ "name": "string", "description": "string (optional)", "technologies": ["string"], "bullets": ["string"] }],
  "skills": { "languages": ["string"], "frameworks": ["string"], "tools": ["string"], "other": ["string"] },
  "customSections": [{ "label": "string", "content": "string" }]
}`;

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_APP_URL ?? "http://localhost:3000",
        "X-Title": process.env.OPENROUTER_APP_NAME ?? "Resume Optimizer",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: extractionSystemPrompt },
          { role: "user", content: JSON.stringify(optimizedSections) },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter API error ${res.status}: ${body}`);
    }

    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>;
      error?: { message: string };
    };

    if (data.error) throw new Error(`OpenRouter error: ${data.error.message}`);

    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response");

    return ResumeDataSchema.parse(JSON.parse(content));
  }
}
