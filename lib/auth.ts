import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "contractorcopilot_session";
export const MFA_PENDING_COOKIE = "contractorcopilot_mfa_pending";

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  companyId?: string;
  role?: "OWNER" | "ADMIN" | "ESTIMATOR" | "TECHNICIAN" | "VIEWER";
  isDemo?: boolean;
  sessionVersion?: number;
};

type SessionPayload = AuthUser & { exp: number; kind: "session" };
type MfaPendingPayload = Pick<AuthUser, "id" | "email" | "name" | "sessionVersion"> & { exp: number; kind: "mfa" };

export class AuthenticationError extends Error {
  status = 401;

  constructor(message = "Sign in is required to use this endpoint.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Demo mode is automatic during local development, but can never turn itself
 * on for a production deployment. Set DEMO_MODE=true to explicitly enable a
 * hosted product walkthrough.
 */
export function isDemoMode() {
  return (
    process.env.DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.DEMO_MODE !== "false")
  );
}

function sessionSecret() {
  const configured = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? process.env.SESSION_SECRET;
  if (configured) return configured;

  // This value is only available in local demo mode. Production callers get
  // no session instead of a predictable signing key.
  return isDemoMode() ? "contractorcopilot-local-demo-only" : null;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(user: AuthUser, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const secret = sessionSecret();
  if (!secret) throw new AuthenticationError("AUTH_SECRET must be configured in production.");

  const payload: SessionPayload = {
    ...user,
    sessionVersion: user.sessionVersion ?? 0,
    kind: "session",
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

/** A short-lived cookie issued only after a password succeeds for an MFA user. */
export function createMfaPendingToken(user: AuthUser, maxAgeSeconds = 10 * 60) {
  const secret = sessionSecret();
  if (!secret) throw new AuthenticationError("AUTH_SECRET must be configured in production.");
  const payload: MfaPendingPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    sessionVersion: user.sessionVersion ?? 0,
    kind: "mfa",
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

function readSessionToken(token: string): AuthUser | null {
  const secret = sessionSecret();
  if (!secret) return null;

  const [encoded, receivedSignature, ...extra] = token.split(".");
  if (!encoded || !receivedSignature || extra.length) return null;

  const expectedSignature = sign(encoded, secret);
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(decode(encoded)) as SessionPayload;
    if (!payload.id || !payload.email || payload.kind !== "session" || payload.exp <= Math.floor(Date.now() / 1000) || !Number.isInteger(payload.sessionVersion)) return null;

    return {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      companyId: payload.companyId,
      role: payload.role,
      isDemo: payload.isDemo,
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}

function readMfaPendingToken(token: string): MfaPendingPayload | null {
  const secret = sessionSecret();
  if (!secret) return null;
  const [encoded, receivedSignature, ...extra] = token.split(".");
  if (!encoded || !receivedSignature || extra.length) return null;
  const expected = Buffer.from(sign(encoded, secret));
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(decode(encoded)) as MfaPendingPayload;
    if (!payload.id || !payload.email || payload.kind !== "mfa" || payload.exp <= Math.floor(Date.now() / 1000) || !Number.isInteger(payload.sessionVersion)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const demoUser: AuthUser = {
  id: "demo-user",
  email: "demo@contractorcopilot.app",
  name: "Alex Contractor",
  companyId: "demo-company",
  role: "OWNER",
  isDemo: true,
  sessionVersion: 0,
};

async function validateStoredUser(user: AuthUser) {
  if (user.isDemo) return isDemoMode() ? user : null;
  const { prisma } = await import("@/lib/db");
  if (!prisma) return null;
  const stored = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true, name: true, sessionVersion: true },
  });
  if (!stored || stored.sessionVersion !== user.sessionVersion) return null;
  return { ...user, email: stored.email, name: stored.name, sessionVersion: stored.sessionVersion } satisfies AuthUser;
}

/**
 * Adapter boundary for real authentication. Replace or wrap this function
 * with an Auth.js/Clerk/Supabase session lookup without changing API routes.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = readSessionToken(token);
    if (user) return validateStoredUser(user);
  }

  return isDemoMode() ? demoUser : null;
}

/** Resolves a password-authenticated user who still needs to complete TOTP. */
export async function getMfaPendingUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(MFA_PENDING_COOKIE)?.value;
  if (!token) return null;
  const pending = readMfaPendingToken(token);
  if (!pending) return null;
  return validateStoredUser({
    id: pending.id,
    email: pending.email,
    name: pending.name,
    sessionVersion: pending.sessionVersion,
  });
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}

/** Returns true only for a real platform operator (or the local demo account). */
export async function isPlatformAdmin(user: AuthUser) {
  if (user.isDemo && isDemoMode()) return true;
  const { prisma } = await import("@/lib/db");
  if (!prisma) return false;
  const storedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isAdmin: true } });
  return storedUser?.isAdmin === true;
}

export function hasAtLeastRole(
  user: AuthUser,
  minimum: "OWNER" | "ADMIN" | "ESTIMATOR" | "TECHNICIAN" | "VIEWER",
) {
  const rank = { OWNER: 5, ADMIN: 4, ESTIMATOR: 3, TECHNICIAN: 2, VIEWER: 1 } as const;
  return rank[user.role ?? "VIEWER"] >= rank[minimum];
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

export const mfaPendingCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 10 * 60,
};
