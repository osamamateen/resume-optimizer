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
    resumeData: null,
    atsScore: MOCK_ORIGINAL_ATS_SCORE,
    matchedKeywords: MOCK_ORIGINAL_MATCHED_KEYWORDS,
    missingKeywords: MOCK_ORIGINAL_MISSING_KEYWORDS,
    summaryOfChanges: null,
    originalAtsScore: MOCK_ORIGINAL_ATS_SCORE,
    originalMatchedKeywords: MOCK_ORIGINAL_MATCHED_KEYWORDS,
    originalMissingKeywords: MOCK_ORIGINAL_MISSING_KEYWORDS,
    suggestions: MOCK_SUGGESTIONS,
    createdAt: new Date().toISOString(),
  });
}
