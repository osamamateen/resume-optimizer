import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";
import { ResumeDataSchema } from "@/types/resume.types";
import { mockResponse } from "./response";
import { MOCK_APPLICATION_ID } from "@/app/api/score/response";

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

  if (id === MOCK_APPLICATION_ID) {
    return mockResponse();
  }

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  if (application.resumeData === null) {
    return NextResponse.json({ error: "This resume hasn't been optimized yet" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { resumeData } = (body ?? {}) as { resumeData?: unknown };
  const parsed = ResumeDataSchema.safeParse(resumeData);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resume data", details: parsed.error.format() }, { status: 400 });
  }

  const updated = await prisma.application.update({
    where: { id },
    data: { resumeData: parsed.data },
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
    summaryOfChanges: updated.summaryHeadline
      ? { headline: updated.summaryHeadline, bullets: updated.summaryBullets }
      : null,
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
