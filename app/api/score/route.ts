import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { parseDocx } from "@/lib/parsing/docx";
import { extractPdfText } from "@/lib/parsing/pdf";
import { sectionsFromDocxSegments, sectionsFromPlainText } from "@/lib/parsing/extractSections";
import { getAiProvider } from "@/lib/ai/provider";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";
import { prisma } from "@/lib/prisma";
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

  const form = await req.formData();
  const jobDescription = form.get("jobDescription");
  const companyName = form.get("companyName");
  const roleTitle = form.get("roleTitle");
  const useMaster = form.get("useMaster") === "true";
  const saveAsMaster = form.get("saveAsMaster") === "true";
  const uploadedFile = form.get("resume");

  if (typeof jobDescription !== "string" || !jobDescription.trim()) {
    return NextResponse.json({ error: "Missing job description" }, { status: 400 });
  }
  if (typeof companyName !== "string" || !companyName.trim()) {
    return NextResponse.json({ error: "Missing company name" }, { status: 400 });
  }
  if (typeof roleTitle !== "string" || !roleTitle.trim()) {
    return NextResponse.json({ error: "Missing role title" }, { status: 400 });
  }

  let fileName: string;
  let mimeType: string;
  let buffer: Buffer;

  if(test){

    return mockResponse();
  }

  if (useMaster) {
    const masterResume = await prisma.masterResume.findUnique({ where: { userId } });
    if (!masterResume) {
      return NextResponse.json({ error: "No master resume on file" }, { status: 400 });
    }
    fileName = masterResume.fileName;
    mimeType = masterResume.mimeType;
    buffer = Buffer.from(masterResume.fileData);
  } else {
    if (!(uploadedFile instanceof File)) {
      return NextResponse.json({ error: "Missing resume file" }, { status: 400 });
    }
    fileName = uploadedFile.name;
    mimeType = uploadedFile.type;
    buffer = Buffer.from(await uploadedFile.arrayBuffer());
  }

  const lowerName = fileName.toLowerCase();
  const isDocx = lowerName.endsWith(".docx");
  const isPdf = lowerName.endsWith(".pdf");

  if (!isDocx && !isPdf) {
    return NextResponse.json({ error: "Only .docx and .pdf resumes are supported" }, { status: 400 });
  }

  if (!useMaster && saveAsMaster) {
    const fileData = new Uint8Array(buffer);
    await prisma.masterResume.upsert({
      where: { userId },
      create: { userId, fileName, mimeType, fileData },
      update: { fileName, mimeType, fileData },
    });
  }

  const sections = isDocx
    ? sectionsFromDocxSegments((await parseDocx(buffer)).segments)
    : sectionsFromPlainText(await extractPdfText(buffer));

  if (sections.length === 0) {
    return NextResponse.json({ error: "Couldn't find any readable text in that file" }, { status: 400 });
  }

  const ai = getAiProvider();
  let result;
  console.time("Scoring resume with AI");
  try {
    result = await ai.scoreResume({ sections, jobDescription });
  } catch (err) {
    console.error("AI scoring failed", err);
    return NextResponse.json({ error: "Resume scoring failed. Please try again." }, { status: 502 });
  } finally {
    console.timeEnd("Scoring resume with AI");
  }

  const application = await prisma.application.create({
    data: {
      userId,
      companyName: companyName.trim(),
      roleTitle: roleTitle.trim(),
      jobDescription,
      originalSections: sections as unknown as Prisma.InputJsonValue,
      originalAtsScore: result.atsScore,
      originalMatchedKeywords: result.matchedKeywords,
      originalMissingKeywords: result.missingKeywords,
      suggestionsHeadline: result.suggestions.headline,
      suggestionsBullets: result.suggestions.bullets,
      atsScore: result.atsScore,
      matchedKeywords: result.matchedKeywords,
      missingKeywords: result.missingKeywords,
    },
  });

  return NextResponse.json({
    applicationId: application.id,
    atsScore: result.atsScore,
    matchedKeywords: result.matchedKeywords,
    missingKeywords: result.missingKeywords,
    suggestions: result.suggestions,
  });
}
