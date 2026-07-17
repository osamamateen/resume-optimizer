import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

async function loadOwnedApplication(id: string, userId: string) {
  const application = await prisma.application.findUnique({ where: { id } });
  if (!application || application.userId !== userId) {
    return null;
  }
  return application;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const application = await loadOwnedApplication(id, userId);
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: application.id,
    companyName: application.companyName,
    roleTitle: application.roleTitle,
    jobDescription: application.jobDescription,
    resumeData: application.resumeData,
    atsScore: application.atsScore,
    matchedKeywords: application.matchedKeywords,
    missingKeywords: application.missingKeywords,
    summaryOfChanges: application.summaryHeadline
      ? { headline: application.summaryHeadline, bullets: application.summaryBullets }
      : null,
    originalAtsScore: application.originalAtsScore,
    originalMatchedKeywords: application.originalMatchedKeywords,
    originalMissingKeywords: application.originalMissingKeywords,
    suggestions: {
      headline: application.suggestionsHeadline,
      bullets: application.suggestionsBullets,
    },
    createdAt: application.createdAt,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const application = await loadOwnedApplication(id, userId);
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.application.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
