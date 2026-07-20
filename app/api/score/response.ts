import { NextResponse } from "next/server";

export const MOCK_APPLICATION_ID = "cmrp0cr0m000ii9dkkn957yh6";

export const MOCK_ORIGINAL_ATS_SCORE = 72;

export const MOCK_ORIGINAL_MATCHED_KEYWORDS = [
  "React",
  "TypeScript",
  "Next.js",
  "Node.js",
  "REST APIs",
  "Git",
  "Agile",
  "Prisma",
];

export const MOCK_ORIGINAL_MISSING_KEYWORDS = [
  "AWS",
  "Docker",
  "Kubernetes",
  "CI/CD",
  "GraphQL",
];

export const MOCK_SUGGESTIONS = {
  headline:
    "Your resume aligns well with the job description but can be strengthened by highlighting cloud technologies and deployment experience.",
  bullets: [
    "Add measurable achievements using metrics where possible.",
    "Include experience with AWS or other cloud platforms.",
    "Mention Docker and containerized application deployments.",
    "Highlight CI/CD pipeline experience.",
    "Add GraphQL experience if applicable.",
    "Emphasize leadership and cross-functional collaboration.",
    "Tailor your summary to match the job description keywords.",
  ],
};

export async function mockResponse() {
  return NextResponse.json({
    applicationId: MOCK_APPLICATION_ID,
    atsScore: MOCK_ORIGINAL_ATS_SCORE,
    matchedKeywords: MOCK_ORIGINAL_MATCHED_KEYWORDS,
    missingKeywords: MOCK_ORIGINAL_MISSING_KEYWORDS,
    suggestions: MOCK_SUGGESTIONS,
  });
}