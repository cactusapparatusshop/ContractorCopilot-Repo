import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createMfaPendingToken, createSessionToken, demoUser, isDemoMode, MFA_PENDING_COOKIE, mfaPendingCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { issueAccountToken } from "@/lib/account-tokens";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendVerificationEmail } from "@/lib/email";
import { errorResponse, HttpError, passwordField, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type SignInRequest = { email?: unknown; password?: unknown };

function validEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

/** Database-backed email/password sign-in, with a safe local demo fallback. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<SignInRequest>(request);
    const email = stringField(body.email, "email", { max: 180 })!.toLowerCase();
    const password = passwordField(body.password);
    if (!validEmail(email)) throw new HttpError(400, "INVALID_REQUEST", "Enter a valid email address.");

    const limiter = takeRateLimit(`sign-in:${email}`, 8, 15 * 60_000);
    if (!limiter.allowed) throw new HttpError(429, "RATE_LIMITED", "Too many sign-in attempts. Please try again later.");

    if (!prisma) {
      if (!isDemoMode()) throw new HttpError(503, "AUTH_UNAVAILABLE", "Authentication has not been configured yet.");
      const response = NextResponse.json({ user: demoUser, mode: "demo" });
      response.cookies.set(SESSION_COOKIE, createSessionToken(demoUser), sessionCookieOptions);
      return response;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
    }

    if (!user.emailVerified) {
      if (!isEmailConfigured()) throw new HttpError(503, "EMAIL_UNAVAILABLE", "Account email verification is not configured yet.");
      const verificationToken = await issueAccountToken("verify-email", user.id, 24 * 60 * 60_000);
      await sendVerificationEmail({ email: user.email, token: verificationToken });
      throw new HttpError(403, "EMAIL_VERIFICATION_REQUIRED", "Verify your email before signing in. We sent you a fresh verification link.");
    }

    const membership = user.memberships[0];
    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      companyId: membership?.companyId,
      role: membership?.role,
      isDemo: false,
      sessionVersion: user.sessionVersion,
    } as const;

    if (user.twoFactorEnabledAt && user.twoFactorSecretCiphertext) {
      const response = NextResponse.json({ mfaRequired: true, email: user.email, mode: "live" });
      response.cookies.set(MFA_PENDING_COOKIE, createMfaPendingToken(sessionUser), mfaPendingCookieOptions);
      response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
      return response;
    }

    const session = createSessionToken({
      ...sessionUser,
    });
    const response = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name }, mode: "live" });
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions);
    response.cookies.set(MFA_PENDING_COOKIE, "", { ...mfaPendingCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
