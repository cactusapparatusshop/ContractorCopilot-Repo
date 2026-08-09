import { NextResponse } from "next/server";

import { createSessionToken, requireUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, privateNoStoreHeaders, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { decryptTotpSecret, generateRecoveryCodes, hashRecoveryCode, matchTotpCode } from "@/lib/two-factor";

export const runtime = "nodejs";

type ConfirmSetupRequest = { code?: unknown };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    if (user.isDemo || !prisma) throw new HttpError(503, "TWO_FACTOR_UNAVAILABLE", "Two-factor authentication is unavailable in the preview workspace.");
    const body = await readJson<ConfirmSetupRequest>(request);
    const code = stringField(body.code, "code", { max: 20 })!;
    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorPendingCiphertext: true, twoFactorPendingExpiresAt: true, twoFactorEnabledAt: true },
    });
    if (!stored?.twoFactorPendingCiphertext || !stored.twoFactorPendingExpiresAt || stored.twoFactorPendingExpiresAt <= new Date() || stored.twoFactorEnabledAt) {
      throw new HttpError(400, "TWO_FACTOR_SETUP_EXPIRED", "Start two-factor setup again to get a fresh authenticator key.");
    }
    const secret = decryptTotpSecret(stored.twoFactorPendingCiphertext);
    const matchedCounter = matchTotpCode(secret, code);
    if (matchedCounter === null) throw new HttpError(400, "INVALID_TWO_FACTOR_CODE", "That authenticator code is not valid. Check your device clock and try again.");

    const recoveryCodes = generateRecoveryCodes();
    const updatedUser = await prisma.$transaction(async (db) => {
      const enabled = await db.user.updateMany({
        where: { id: user.id, twoFactorEnabledAt: null, twoFactorPendingExpiresAt: { gt: new Date() } },
        data: {
          twoFactorSecretCiphertext: stored.twoFactorPendingCiphertext,
          twoFactorPendingCiphertext: null,
          twoFactorPendingExpiresAt: null,
          twoFactorEnabledAt: new Date(),
          twoFactorLastUsedCounter: matchedCounter,
          sessionVersion: { increment: 1 },
        },
      });
      if (enabled.count !== 1) throw new HttpError(409, "TWO_FACTOR_SETUP_EXPIRED", "Start two-factor setup again to get a fresh authenticator key.");
      await db.twoFactorRecoveryCode.deleteMany({ where: { userId: user.id } });
      await db.twoFactorRecoveryCode.createMany({ data: recoveryCodes.map((recoveryCode) => ({ userId: user.id, codeHash: hashRecoveryCode(recoveryCode) })) });
      return db.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, email: true, name: true, sessionVersion: true } });
    });

    const response = NextResponse.json(
      { enabled: true, recoveryCodes },
      { headers: { ...privateNoStoreHeaders, "Referrer-Policy": "no-referrer" } },
    );
    response.cookies.set(SESSION_COOKIE, createSessionToken({ ...user, ...updatedUser, isDemo: false }), sessionCookieOptions);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
