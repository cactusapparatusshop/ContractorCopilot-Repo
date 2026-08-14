import { NextResponse } from "next/server";

import { getMfaPendingState } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, requireSameOrigin } from "@/lib/http";
import { sendPhoneVerification } from "@/lib/phone-verification";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Resends a code only for a password-authenticated or newly-created account. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const pending = await getMfaPendingState();
    if (!pending || pending.method !== "phone" || !prisma) throw new HttpError(401, "PHONE_SESSION_REQUIRED", "Start sign-in again before requesting another phone code.");
    const limit = takeRateLimit(`phone-code:${pending.user.id}`, 3, 15 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "RATE_LIMITED", "Please wait before requesting another phone code.");
    const user = await prisma.user.findUnique({ where: { id: pending.user.id }, select: { phone: true, sessionVersion: true } });
    if (!user?.phone || user.sessionVersion !== pending.user.sessionVersion) throw new HttpError(401, "PHONE_SESSION_REQUIRED", "Start sign-in again before requesting another phone code.");
    await sendPhoneVerification(user.phone);
    return NextResponse.json({ sent: true });
  } catch (error) {
    return errorResponse(error);
  }
}
