import { NextRequest, NextResponse } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";
import { getUsageSummary } from "@/lib/services/usage.service";

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

  const summary = await getUsageSummary(userId);
  return NextResponse.json(summary);
}
