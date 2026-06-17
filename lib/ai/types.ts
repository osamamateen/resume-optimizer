import { z } from "zod";

export const sectionInputSchema = z.object({
  id: z.string(),
  heading: z.string().nullable(),
  originalText: z.string(),
});
export type SectionInput = z.infer<typeof sectionInputSchema>;

export const optimizationResultSchema = z.object({
  sections: z.array(z.object({ id: z.string(), optimizedText: z.string() })),
  atsScore: z.number().min(0).max(100),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  summaryOfChanges: z.object({
    headline: z.string(),
    bullets: z.array(z.string()),
  }),
});
export type OptimizationResult = z.infer<typeof optimizationResultSchema>;

export interface OptimizeRequest {
  sections: SectionInput[];
  jobDescription: string;
}

export interface AiProvider {
  optimizeResume(request: OptimizeRequest): Promise<OptimizationResult>;
  extractStructuredResume(
    optimizedSections: Array<{ id: string; optimizedText: string }>
  ): Promise<import("../../types/resume.types").ResumeData>;
}
