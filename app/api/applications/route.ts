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

  const rows = await prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyName: true,
      roleTitle: true,
      atsScore: true,
      createdAt: true,
      resumeData: true,
    },
  });

  const applications = rows.map(({ resumeData, ...rest }) => ({
    ...rest,
    optimized: resumeData !== null,
  }));

  return NextResponse.json({ applications });
}
