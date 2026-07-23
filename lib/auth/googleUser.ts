import { prisma } from "@/lib/prisma";
import type { GoogleIdentity } from "./google";

export class GoogleAccountCollisionError extends Error {}

export async function findOrCreateGoogleUser(identity: GoogleIdentity): Promise<string> {
  const byGoogleId = await prisma.user.findUnique({ where: { googleId: identity.googleId } });
  if (byGoogleId) {
    return byGoogleId.id;
  }

  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });
  if (byEmail) {
    throw new GoogleAccountCollisionError(
      "An account with this email already exists. Log in with your password instead."
    );
  }

  const created = await prisma.user.create({
    data: { email: identity.email, googleId: identity.googleId, passwordHash: null },
  });
  return created.id;
}
