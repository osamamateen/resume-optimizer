import { SignJWT, jwtVerify } from "jose";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

function getAccessSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error("JWT_ACCESS_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getAccessSecret());
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, getAccessSecret());
  if (typeof payload.sub !== "string") {
    throw new Error("Token payload missing sub");
  }
  return payload.sub;
}
