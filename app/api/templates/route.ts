import { NextRequest, NextResponse } from "next/server";
import { listTemplates } from "@/lib/templates/registry";
import { requireAuth, UnauthorizedError } from "@/lib/auth/requireAuth";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
  return NextResponse.json(listTemplates());
}
