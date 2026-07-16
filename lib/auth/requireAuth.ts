import { NextRequest } from "next/server";
import { verifyAccessToken } from "./tokens";

export class UnauthorizedError extends Error {}

export async function requireAuth(req: NextRequest): Promise<string> {
  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing bearer token");
  }
  const token = header.slice("Bearer ".length);
  try {
    return await verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid token");
  }
}
