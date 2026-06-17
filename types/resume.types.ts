import { z } from "zod";

export const ResumeDataSchema = z.object({
  contact: z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    website: z.string().optional(),
  }),
  summary: z.string().optional(),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().optional(),
      startDate: z.string(),
      endDate: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string().optional(),
      graduationDate: z.string(),
    })
  ),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        technologies: z.array(z.string()),
        bullets: z.array(z.string()),
      })
    )
    .optional(),
  skills: z
    .object({
      languages: z.array(z.string()),
      frameworks: z.array(z.string()),
      tools: z.array(z.string()),
      other: z.array(z.string()),
    })
    .optional(),
  customSections: z
    .array(
      z.object({
        label: z.string(),
        content: z.string(),
      })
    )
    .optional(),
});

export type ResumeData = z.infer<typeof ResumeDataSchema>;
