import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createSessionToken, demoUser, isDemoMode, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { issueAccountToken } from "@/lib/account-tokens";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendVerificationEmail } from "@/lib/email";
import { errorResponse, HttpError, passwordField, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type SignUpRequest = { name?: unknown; companyName?: unknown; email?: unknown; password?: unknown };

function validEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function uniqueSlug(companyName: string) {
  const root = companyName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42) || "contractor-company";
  return `${root}-${randomUUID().slice(0, 7)}`;
}

/** Creates the first company owner and asks them to verify their email. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<SignUpRequest>(request);
    const name = stringField(body.name, "name", { max: 120 })!;
    const companyName = stringField(body.companyName, "companyName", { max: 120 })!;
    const email = stringField(body.email, "email", { max: 180 })!.toLowerCase();
    const password = passwordField(body.password);
    if (!validEmail(email)) throw new HttpError(400, "INVALID_REQUEST", "Enter a valid email address.");
    if (password.length < 12) throw new HttpError(400, "WEAK_PASSWORD", "Use at least 12 characters for your password.");

    const limiter = takeRateLimit(`sign-up:${email}`, 4, 60 * 60_000);
    if (!limiter.allowed) throw new HttpError(429, "RATE_LIMITED", "Too many registration attempts. Please try again later.");

    if (!prisma) {
      if (!isDemoMode()) throw new HttpError(503, "AUTH_UNAVAILABLE", "Authentication has not been configured yet.");
      const response = NextResponse.json({ user: demoUser, company: { id: demoUser.companyId, name: "Demo Contractor Co." }, mode: "demo" }, { status: 201 });
      response.cookies.set(SESSION_COOKIE, createSessionToken(demoUser), sessionCookieOptions);
      return response;
    }

    if (!isEmailConfigured()) {
      throw new HttpError(503, "EMAIL_UNAVAILABLE", "Account email verification is not configured yet. Please try again shortly.");
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new HttpError(409, "EMAIL_IN_USE", "An account with that email already exists.");
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.$transaction(async (db) => {
      const user = await db.user.create({ data: { name, email, passwordHash } });
      const company = await db.company.create({ data: { name: companyName, slug: uniqueSlug(companyName), email } });
      const membership = await db.membership.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });
      return { user, company, membership };
    });

    const verificationToken = await issueAccountToken("verify-email", created.user.id, 24 * 60 * 60_000);
    await sendVerificationEmail({ email: created.user.email, token: verificationToken });
    return NextResponse.json({ verificationRequired: true, email: created.user.email, company: { id: created.company.id, name: created.company.name }, mode: "live" }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
