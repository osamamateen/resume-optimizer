import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export interface GoogleIdentity {
  email: string;
  googleId: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  });
  if (payload.email_verified !== true || typeof payload.email !== "string" || typeof payload.sub !== "string") {
    throw new Error("Google account email is not verified");
  }
  return { email: payload.email, googleId: payload.sub };
}
