import { z } from "zod";
import { ResumeDataSchema } from "../../types/resume.types";

export const sectionInputSchema = z.object({
  id: z.string(),
  heading: z.string().nullable(),
  originalText: z.string(),
});
export type SectionInput = z.infer<typeof sectionInputSchema>;

export const optimizationResultSchema = z.object({
  atsScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  summaryOfChanges: z.object({
    headline: z.string(),
    bullets: z.array(z.string()),
  }),
  resumeData: ResumeDataSchema,
});
export type OptimizationResult = z.infer<typeof optimizationResultSchema>;

export const scoreResultSchema = z.object({
  atsScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  suggestions: z.object({
    headline: z.string(),
    bullets: z.array(z.string()),
  }),
});
export type ScoreResult = z.infer<typeof scoreResultSchema>;

export interface OptimizeRequest {
  sections: SectionInput[];
  jobDescription: string;
}

export interface AiProvider {
  scoreResume(request: OptimizeRequest): Promise<ScoreResult>;
  optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>;
}
