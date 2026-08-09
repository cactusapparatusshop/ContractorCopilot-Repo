import { NextResponse } from "next/server";

import { createSessionToken, getMfaPendingUser, MFA_PENDING_COOKIE, mfaPendingCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { decryptTotpSecret, hashRecoveryCode, matchTotpCode } from "@/lib/two-factor";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type VerifyRequest = { code?: unknown };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const pending = await getMfaPendingUser();
    if (!pending || !prisma) throw new HttpError(401, "MFA_SESSION_REQUIRED", "Sign in with your password again before entering an authenticator code.");
    const body = await readJson<VerifyRequest>(request);
    const code = stringField(body.code, "code", { max: 40 })!;
    const limit = takeRateLimit(`two-factor:${pending.id}`, 8, 15 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "RATE_LIMITED", "Too many authenticator attempts. Sign in again and try later.");
    const user = await prisma.user.findUnique({
      where: { id: pending.id },
      include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    if (!user || user.sessionVersion !== pending.sessionVersion) {
      throw new HttpError(401, "MFA_SESSION_REQUIRED", "Sign in with your password again before entering an authenticator code.");
    }
    if (!user.twoFactorEnabledAt || !user.twoFactorSecretCiphertext) throw new HttpError(401, "MFA_NOT_ENABLED", "Two-factor authentication is not enabled for this account.");

    let verified = false;
    if (/^\s*\d{6}\s*$/.test(code)) {
      const counter = matchTotpCode(decryptTotpSecret(user.twoFactorSecretCiphertext), code);
      if (counter !== null) {
        const used = await prisma.user.updateMany({
          where: { id: user.id, OR: [{ twoFactorLastUsedCounter: null }, { twoFactorLastUsedCounter: { lt: counter } }] },
          data: { twoFactorLastUsedCounter: counter },
        });
        verified = used.count === 1;
      }
    } else {
      const used = await prisma.twoFactorRecoveryCode.updateMany({
        where: { userId: user.id, codeHash: hashRecoveryCode(code), usedAt: null },
        data: { usedAt: new Date() },
      });
      verified = used.count === 1;
    }
    if (!verified) throw new HttpError(401, "INVALID_TWO_FACTOR_CODE", "That authenticator or recovery code is not valid.");

    const membership = user.memberships[0];
    const session = createSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: membership?.companyId,
      role: membership?.role,
      isDemo: false,
      sessionVersion: user.sessionVersion,
    });
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions);
    response.cookies.set(MFA_PENDING_COOKIE, "", { ...mfaPendingCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
