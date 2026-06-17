import { NextRequest, NextResponse } from "next/server";
import { ResumeDataSchema } from "@/types/resume.types";
import { renderResumePDF } from "@/lib/services/pdf-renderer.service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Missing request body" }, { status: 400 });
  }

  const { resumeData, templateId } = body as { resumeData: unknown; templateId?: string };

  const parsed = ResumeDataSchema.safeParse(resumeData);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid resume data", details: parsed.error.format() }, { status: 400 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderResumePDF(parsed.data, templateId ?? "modern");
  } catch (err) {
    console.error("PDF rendering failed", err);
    return NextResponse.json({ error: "PDF rendering failed. Please try again." }, { status: 500 });
  }

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="resume.pdf"',
    },
  });
}
