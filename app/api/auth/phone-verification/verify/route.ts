import { NextResponse } from "next/server";

import { createSessionToken, getMfaPendingState, MFA_PENDING_COOKIE, mfaPendingCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { verifyPhoneCode } from "@/lib/phone-verification";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type VerifyRequest = { code?: unknown };

/** Completes either initial phone registration or the SMS sign-in factor. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const pending = await getMfaPendingState();
    if (!pending || pending.method !== "phone" || !prisma) throw new HttpError(401, "PHONE_SESSION_REQUIRED", "Sign in again before entering a phone code.");
    const body = await readJson<VerifyRequest>(request);
    const code = stringField(body.code, "code", { max: 10 })!;
    if (!/^\d{4,10}$/.test(code)) throw new HttpError(400, "INVALID_PHONE_CODE", "Enter the verification code from your text message.");
    const limit = takeRateLimit(`phone-verify:${pending.user.id}`, 8, 15 * 60_000);
    if (!limit.allowed) throw new HttpError(429, "RATE_LIMITED", "Too many verification attempts. Sign in again and try later.");
    const user = await prisma.user.findUnique({ where: { id: pending.user.id }, include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } } });
    if (!user?.phone || user.sessionVersion !== pending.user.sessionVersion) throw new HttpError(401, "PHONE_SESSION_REQUIRED", "Sign in again before entering a phone code.");
    if (!(await verifyPhoneCode(user.phone, code))) throw new HttpError(401, "INVALID_PHONE_CODE", "That phone verification code is not valid or has expired.");

    const verified = user.phoneVerifiedAt ? user : await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() }, include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } } });
    const membership = verified.memberships[0];
    const session = createSessionToken({ id: verified.id, email: verified.email, name: verified.name, companyId: membership?.companyId, role: membership?.role, isDemo: false, sessionVersion: verified.sessionVersion });
    const response = NextResponse.json({ authenticated: true, phoneVerified: true });
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions);
    response.cookies.set(MFA_PENDING_COOKIE, "", { ...mfaPendingCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
