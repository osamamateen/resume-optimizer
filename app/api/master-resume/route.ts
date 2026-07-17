import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const masterResume = await prisma.masterResume.findUnique({ where: { userId } });
  if (!masterResume) {
    return NextResponse.json({ error: "No master resume on file" }, { status: 404 });
  }

  return NextResponse.json({
    fileName: masterResume.fileName,
    updatedAt: masterResume.updatedAt,
  });
}

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
  const file = form.get("resume");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing resume file" }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".docx") && !lowerName.endsWith(".pdf")) {
    return NextResponse.json({ error: "Only .docx and .pdf resumes are supported" }, { status: 400 });
  }

  const fileData = Buffer.from(await file.arrayBuffer());

  const masterResume = await prisma.masterResume.upsert({
    where: { userId },
    create: { userId, fileName: file.name, mimeType: file.type, fileData },
    update: { fileName: file.name, mimeType: file.type, fileData },
  });

  return NextResponse.json({
    fileName: masterResume.fileName,
    updatedAt: masterResume.updatedAt,
  });
}
