import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createSessionToken, requireUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, passwordField, privateNoStoreHeaders, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { decryptTotpSecret, hashRecoveryCode, matchTotpCode } from "@/lib/two-factor";

export const runtime = "nodejs";

type DisableRequest = { currentPassword?: unknown; code?: unknown };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    if (user.isDemo || !prisma) throw new HttpError(503, "TWO_FACTOR_UNAVAILABLE", "Two-factor authentication is unavailable in the preview workspace.");
    const body = await readJson<DisableRequest>(request);
    const currentPassword = passwordField(body.currentPassword, "currentPassword");
    const code = stringField(body.code, "code", { max: 40 })!;
    const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, twoFactorSecretCiphertext: true, twoFactorEnabledAt: true } });
    if (!stored?.passwordHash || !(await bcrypt.compare(currentPassword, stored.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Enter your current password to change two-factor authentication.");
    }
    if (!stored.twoFactorEnabledAt || !stored.twoFactorSecretCiphertext) throw new HttpError(400, "MFA_NOT_ENABLED", "Two-factor authentication is not enabled for this account.");

    let verified = false;
    if (/^\s*\d{6}\s*$/.test(code)) verified = matchTotpCode(decryptTotpSecret(stored.twoFactorSecretCiphertext), code) !== null;
    else {
      const used = await prisma.twoFactorRecoveryCode.updateMany({ where: { userId: user.id, codeHash: hashRecoveryCode(code), usedAt: null }, data: { usedAt: new Date() } });
      verified = used.count === 1;
    }
    if (!verified) throw new HttpError(401, "INVALID_TWO_FACTOR_CODE", "That authenticator or recovery code is not valid.");

    const updatedUser = await prisma.$transaction(async (db) => {
      const updated = await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecretCiphertext: null,
          twoFactorPendingCiphertext: null,
          twoFactorPendingExpiresAt: null,
          twoFactorEnabledAt: null,
          twoFactorLastUsedCounter: null,
          sessionVersion: { increment: 1 },
        },
        select: { id: true, email: true, name: true, sessionVersion: true },
      });
      await db.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } });
      return updated;
    });
    const response = NextResponse.json({ enabled: false }, { headers: { ...privateNoStoreHeaders, "Referrer-Policy": "no-referrer" } });
    response.cookies.set(SESSION_COOKIE, createSessionToken({ ...user, ...updatedUser, isDemo: false }), sessionCookieOptions);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
