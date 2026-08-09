import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, passwordField, privateNoStoreHeaders, readJson, requireSameOrigin } from "@/lib/http";
import { createOtpAuthUrl, encryptTotpSecret, generateTotpSecret, isTwoFactorConfigured } from "@/lib/two-factor";

export const runtime = "nodejs";

type SetupRequest = { currentPassword?: unknown };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    if (user.isDemo || !prisma) throw new HttpError(503, "TWO_FACTOR_UNAVAILABLE", "Two-factor authentication is unavailable in the preview workspace.");
    if (!isTwoFactorConfigured()) throw new HttpError(503, "TWO_FACTOR_UNAVAILABLE", "Two-factor authentication has not been configured yet.");
    const body = await readJson<SetupRequest>(request);
    const currentPassword = passwordField(body.currentPassword, "currentPassword");
    const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, passwordHash: true, twoFactorEnabledAt: true } });
    if (!stored?.passwordHash || !(await bcrypt.compare(currentPassword, stored.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Enter your current password to set up two-factor authentication.");
    }
    if (stored.twoFactorEnabledAt) throw new HttpError(409, "TWO_FACTOR_ALREADY_ENABLED", "Two-factor authentication is already enabled for this account.");

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorPendingCiphertext: encryptTotpSecret(secret), twoFactorPendingExpiresAt: new Date(Date.now() + 10 * 60_000) },
    });
    return NextResponse.json(
      {
        setupRequired: true,
        manualKey: secret,
        otpAuthUrl: createOtpAuthUrl(stored.email, secret),
        issuer: "ContractorCopilot",
        expiresInSeconds: 10 * 60,
      },
      { headers: { ...privateNoStoreHeaders, "Referrer-Policy": "no-referrer" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
