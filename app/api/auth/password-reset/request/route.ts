import { NextResponse } from "next/server";

import { issueAccountToken } from "@/lib/account-tokens";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type ResetRequest = { email?: unknown };

/** Generic response prevents account enumeration. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<ResetRequest>(request);
    const email = stringField(body.email, "email", { max: 180 })!.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, "INVALID_REQUEST", "Enter a valid email address.");
    const limit = takeRateLimit(`password-reset:${email}`, 3, 15 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "RATE_LIMITED", "Please wait before requesting another reset email.");
    if (!prisma || !isEmailConfigured()) throw new HttpError(503, "EMAIL_UNAVAILABLE", "Account email delivery is not configured yet.");

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true } });
    if (user?.passwordHash) {
      const token = await issueAccountToken("password-reset", user.id, 30 * 60_000);
      await sendPasswordResetEmail({ email: user.email, token });
    }
    return NextResponse.json({ ok: true, message: "If that email belongs to an account, we've sent a reset link." });
  } catch (error) {
    return errorResponse(error);
  }
}
