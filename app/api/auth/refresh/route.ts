import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { signAccessToken } from "@/lib/auth/tokens";
import { rotateRefreshToken, InvalidRefreshTokenError } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 400 });
  }

  try {
    const { userId, refreshToken } = await rotateRefreshToken(parsed.data.refreshToken);
    const accessToken = await signAccessToken(userId);
    return NextResponse.json({ accessToken, refreshToken });
  } catch (err) {
    if (err instanceof InvalidRefreshTokenError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
