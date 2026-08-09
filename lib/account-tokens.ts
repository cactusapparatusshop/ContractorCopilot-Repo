import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";

export type AccountTokenPurpose = "verify-email" | "password-reset";

const TOKEN_BYTES = 32;

function identifier(purpose: AccountTokenPurpose, userId: string) {
  return `${purpose}:${userId}`;
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function randomToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Stores only a SHA-256 digest. The raw token exists only in the outgoing
 * email URL and is invalidated when a newer email is requested.
 */
export async function issueAccountToken(
  purpose: AccountTokenPurpose,
  userId: string,
  expiresInMs: number,
) {
  if (!prisma) throw new Error("The database is unavailable.");
  const rawToken = randomToken();
  const token = tokenDigest(rawToken);
  const tokenIdentifier = identifier(purpose, userId);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: tokenIdentifier } }),
    prisma.verificationToken.create({
      data: { identifier: tokenIdentifier, token, expires: new Date(Date.now() + expiresInMs) },
    }),
  ]);

  return rawToken;
}

/** Atomically consumes a token once and returns the associated user id. */
export async function consumeAccountToken(purpose: AccountTokenPurpose, rawToken: string) {
  if (!prisma || !rawToken || rawToken.length > 256) return null;
  const token = tokenDigest(rawToken);
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith(`${purpose}:`)) return null;

  const claimed = await prisma.verificationToken.deleteMany({
    where: { token, identifier: record.identifier, expires: { gt: new Date() } },
  });
  if (claimed.count !== 1) return null;
  return record.identifier.slice(`${purpose}:`.length) || null;
}

export async function revokeAccountTokens(purpose: AccountTokenPurpose, userId: string) {
  if (!prisma) return;
  await prisma.verificationToken.deleteMany({ where: { identifier: identifier(purpose, userId) } });
}
