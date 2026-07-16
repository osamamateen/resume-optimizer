import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  const pepper = process.env.JWT_REFRESH_HASH_SECRET;
  if (!pepper) throw new Error("JWT_REFRESH_HASH_SECRET is not set");
  return crypto.createHmac("sha256", pepper).update(rawToken).digest("hex");
}

function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export class InvalidRefreshTokenError extends Error {}

export async function issueRefreshToken(userId: string): Promise<string> {
  const rawToken = generateRawToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return rawToken;
}

export async function rotateRefreshToken(
  rawToken: string
): Promise<{ userId: string; refreshToken: string }> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.refreshToken.findFirst({ where: { tokenHash } });

  if (!record) {
    throw new InvalidRefreshTokenError("Refresh token not found");
  }

  if (record.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new InvalidRefreshTokenError("Refresh token already used");
  }

  if (record.expiresAt < new Date()) {
    throw new InvalidRefreshTokenError("Refresh token expired");
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const newRawToken = await issueRefreshToken(record.userId);
  return { userId: record.userId, refreshToken: newRawToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
