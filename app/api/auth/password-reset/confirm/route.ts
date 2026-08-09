import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

import { consumeAccountToken } from "@/lib/account-tokens";
import { MFA_PENDING_COOKIE, mfaPendingCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, passwordField, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ConfirmResetRequest = { token?: unknown; password?: unknown };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<ConfirmResetRequest>(request);
    const token = stringField(body.token, "token", { max: 256 })!;
    const password = passwordField(body.password);
    if (password.length < 12) throw new HttpError(400, "WEAK_PASSWORD", "Use at least 12 characters for your password.");
    const tokenFingerprint = createHash("sha256").update(token).digest("hex").slice(0, 20);
    const limit = takeRateLimit(`password-reset-confirm:${tokenFingerprint}`, 8, 15 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "RATE_LIMITED", "Too many attempts. Please request a fresh password reset link.");

    const userId = await consumeAccountToken("password-reset", token);
    if (!userId || !prisma) throw new HttpError(400, "INVALID_OR_EXPIRED_TOKEN", "This password reset link is invalid or has expired.");
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash, sessionVersion: { increment: 1 }, twoFactorPendingCiphertext: null, twoFactorPendingExpiresAt: null },
      }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);

    const response = NextResponse.json({ reset: true });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    response.cookies.set(MFA_PENDING_COOKIE, "", { ...mfaPendingCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
