import { NextResponse } from "next/server";

import { issueAccountToken } from "@/lib/account-tokens";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendVerificationEmail } from "@/lib/email";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type VerificationRequest = { email?: unknown };

/** Always returns the same success response to avoid revealing account existence. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<VerificationRequest>(request);
    const email = stringField(body.email, "email", { max: 180 })!.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "INVALID_REQUEST", "Enter a valid email address.");
    const limit = takeRateLimit(`verify-email:${email}`, 3, 15 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "RATE_LIMITED", "Please wait before requesting another verification email.");
    if (!prisma || !isEmailConfigured()) throw new HttpError(503, "EMAIL_UNAVAILABLE", "Account email delivery is not configured yet.");

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, emailVerified: true } });
    if (user && !user.emailVerified) {
      const token = await issueAccountToken("verify-email", user.id, 24 * 60 * 60_000);
      await sendVerificationEmail({ email: user.email, token });
    }
    return NextResponse.json({ ok: true, message: "If that account needs verification, we've sent a secure email link." });
  } catch (error) {
    return errorResponse(error);
  }
}
