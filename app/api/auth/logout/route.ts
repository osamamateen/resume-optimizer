import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revokeRefreshToken } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";

const logoutSchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = logoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
  }

  await revokeRefreshToken(parsed.data.refreshToken);
  return new NextResponse(null, { status: 204 });
}
