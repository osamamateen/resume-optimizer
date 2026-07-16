import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/passwords";
import { signAccessToken } from "@/lib/auth/tokens";
import { issueRefreshToken } from "@/lib/auth/refreshTokens";

export const runtime = "nodejs";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email or password", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  const accessToken = await signAccessToken(user.id);
  const refreshToken = await issueRefreshToken(user.id);

  return NextResponse.json({ accessToken, refreshToken }, { status: 201 });
}
