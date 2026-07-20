import { NextRequest, NextResponse } from "next/server";
import { getAiProvider } from "@/lib/ai/provider";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
import type { SectionInput } from "@/lib/ai/types";
import { mockResponse } from "./response";

export const runtime = "nodejs";
export const maxDuration = 120;
const test = process.env.NEXT_PUBLIC_TEST_MODE === "true";
export async function POST(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  
  if(test){
    return mockResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const applicationId = (body as { applicationId?: unknown } | null)?.applicationId;
  if (typeof applicationId !== "string" || !applicationId) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application || application.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ai = getAiProvider();
  let result;
  console.time("Optimizing resume with AI");
  try {
    result = await ai.optimizeResume({
      sections: application.originalSections as unknown as SectionInput[],
      jobDescription: application.jobDescription,
    });
  } catch (err) {
    console.error("AI optimization failed", err);
    return NextResponse.json({ error: "Resume optimization failed. Please try again." }, { status: 502 });
  } finally {
    console.timeEnd("Optimizing resume with AI");
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      atsScore: result.atsScore,
      matchedKeywords: result.matchedKeywords,
      missingKeywords: result.missingKeywords,
      resumeData: result.resumeData,
      summaryHeadline: result.summaryOfChanges.headline,
      summaryBullets: result.summaryOfChanges.bullets,
    },
  });

  return NextResponse.json({
    id: updated.id,
    companyName: updated.companyName,
    roleTitle: updated.roleTitle,
    jobDescription: updated.jobDescription,
    resumeData: updated.resumeData,
    atsScore: updated.atsScore,
    matchedKeywords: updated.matchedKeywords,
    missingKeywords: updated.missingKeywords,
    summaryOfChanges: {
      headline: updated.summaryHeadline,
      bullets: updated.summaryBullets,
    },
    originalAtsScore: updated.originalAtsScore,
    originalMatchedKeywords: updated.originalMatchedKeywords,
    originalMissingKeywords: updated.originalMissingKeywords,
    suggestions: {
      headline: updated.suggestionsHeadline,
      bullets: updated.suggestionsBullets,
    },
    createdAt: updated.createdAt,
  });
}
