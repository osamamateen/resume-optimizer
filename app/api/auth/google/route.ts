import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyGoogleIdToken } from "@/lib/auth/google";
import { findOrCreateGoogleUser, GoogleAccountCollisionError } from "@/lib/auth/googleUser";
import { signAccessToken } from "@/lib/auth/tokens";
import { issueRefreshToken } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";

const googleSchema = z.object({ idToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = googleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
  }

  let identity;
  try {
    identity = await verifyGoogleIdToken(parsed.data.idToken);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId: string;
  try {
    userId = await findOrCreateGoogleUser(identity);
  } catch (err) {
    if (err instanceof GoogleAccountCollisionError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }

  const accessToken = await signAccessToken(userId);
  const refreshToken = await issueRefreshToken(userId);

  return NextResponse.json({ accessToken, refreshToken });
}
