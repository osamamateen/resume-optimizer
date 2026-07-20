import { NextResponse } from "next/server";
import {
  MOCK_APPLICATION_ID,
  MOCK_ORIGINAL_ATS_SCORE,
  MOCK_ORIGINAL_MATCHED_KEYWORDS,
  MOCK_ORIGINAL_MISSING_KEYWORDS,
  MOCK_SUGGESTIONS,
} from "@/app/api/score/response";

export async function mockResponse() {
  return NextResponse.json({
    id: MOCK_APPLICATION_ID,
    companyName: "OpenAI",
    roleTitle: "Frontend Software Engineer",
    jobDescription:
      "We are looking for a Frontend Software Engineer with experience in React, Next.js, TypeScript, Node.js, AWS, Docker, CI/CD, and strong communication skills.",

    resumeData: [
      {
        title: "Professional Summary",
        content: [
          "Frontend Software Engineer with 5+ years of experience building scalable web applications using React, Next.js, TypeScript, and Node.js.",
          "Experienced collaborating with cross-functional teams and deploying applications using AWS, Docker, and CI/CD pipelines.",
        ],
      },
      {
        title: "Experience",
        content: [
          "Developed and maintained enterprise React and Next.js applications serving over 100,000 monthly users.",
          "Reduced page load times by 35% through performance optimization.",
          "Implemented CI/CD pipelines using GitHub Actions.",
          "Containerized applications with Docker and deployed to AWS.",
          "Collaborated with designers, product managers, and backend engineers in Agile teams.",
        ],
      },
      {
        title: "Skills",
        content: [
          "React",
          "Next.js",
          "TypeScript",
          "JavaScript",
          "Node.js",
          "REST APIs",
          "Prisma",
          "PostgreSQL",
          "AWS",
          "Docker",
          "CI/CD",
          "Git",
          "Agile",
        ],
      },
    ],

    atsScore: 91,

    matchedKeywords: [
      ...MOCK_ORIGINAL_MATCHED_KEYWORDS,
      "AWS",
      "Docker",
      "CI/CD",
    ],

    missingKeywords: MOCK_ORIGINAL_MISSING_KEYWORDS.filter(
      (keyword) => !["AWS", "Docker", "CI/CD"].includes(keyword)
    ),

    summaryOfChanges: {
      headline:
        "Your resume has been optimized to better align with the job description.",
      bullets: [
        "Added AWS and Docker experience.",
        "Included CI/CD pipeline achievements.",
        "Strengthened the professional summary with job-specific keywords.",
        "Improved bullet points using measurable accomplishments.",
        "Reorganized skills for better ATS readability.",
      ],
    },

    originalAtsScore: MOCK_ORIGINAL_ATS_SCORE,

    originalMatchedKeywords: MOCK_ORIGINAL_MATCHED_KEYWORDS,

    originalMissingKeywords: MOCK_ORIGINAL_MISSING_KEYWORDS,

    suggestions: MOCK_SUGGESTIONS,

    createdAt: new Date().toISOString(),
  });
}