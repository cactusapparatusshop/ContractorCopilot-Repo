import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createMfaPendingToken, createSessionToken, demoUser, isDemoMode, MFA_PENDING_COOKIE, mfaPendingCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, passwordField, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { normalizePhone, sendPhoneVerification } from "@/lib/phone-verification";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type SignUpRequest = { name?: unknown; companyName?: unknown; email?: unknown; phone?: unknown; password?: unknown };

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

/** Creates the first company owner and starts phone verification. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<SignUpRequest>(request);
    const name = stringField(body.name, "name", { max: 120 })!;
    const companyName = stringField(body.companyName, "companyName", { max: 120 })!;
    const email = stringField(body.email, "email", { max: 180 })!.toLowerCase();
    const phone = normalizePhone(stringField(body.phone, "phone", { max: 24 })!);
    const password = passwordField(body.password);
    if (!validEmail(email)) throw new HttpError(400, "INVALID_REQUEST", "Enter a valid email address.");
    if (password.length < 12) throw new HttpError(400, "WEAK_PASSWORD", "Use at least 12 characters for your password.");

    const limiter = takeRateLimit(`sign-up:${email}:${phone}`, 4, 60 * 60_000);
    if (!limiter.allowed) throw new HttpError(429, "RATE_LIMITED", "Too many registration attempts. Please try again later.");

    if (!prisma) {
      if (!isDemoMode()) throw new HttpError(503, "AUTH_UNAVAILABLE", "Authentication has not been configured yet.");
      const response = NextResponse.json({ user: demoUser, company: { id: demoUser.companyId, name: "Demo Contractor Co." }, mode: "demo" }, { status: 201 });
      response.cookies.set(SESSION_COOKIE, createSessionToken(demoUser), sessionCookieOptions);
      return response;
    }

    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { email: true, phone: true } });
    if (existing?.email === email) throw new HttpError(409, "EMAIL_IN_USE", "An account with that email already exists.");
    if (existing?.phone === phone) throw new HttpError(409, "PHONE_IN_USE", "That mobile number is already connected to an account.");
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.$transaction(async (db) => {
      const user = await db.user.create({ data: { name, email, phone, passwordHash } });
      const company = await db.company.create({ data: { name: companyName, slug: uniqueSlug(companyName), email } });
      const membership = await db.membership.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });
      return { user, company, membership };
    });

    try {
      await sendPhoneVerification(phone);
    } catch (error) {
      await prisma.user.delete({ where: { id: created.user.id } }).catch(() => undefined);
      throw error;
    }
    const response = NextResponse.json({ phoneVerificationRequired: true, phone, company: { id: created.company.id, name: created.company.name }, mode: "live" }, { status: 201 });
    response.cookies.set(MFA_PENDING_COOKIE, createMfaPendingToken({ id: created.user.id, email: created.user.email, name: created.user.name, sessionVersion: created.user.sessionVersion }, "phone"), mfaPendingCookieOptions);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
