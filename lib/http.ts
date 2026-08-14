import "server-only";

import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof Error && error.name === "AuthenticationError") {
    return NextResponse.json({ error: error.message, code: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (error instanceof Error && error.name === "DatabaseUnavailableError") {
    return NextResponse.json(
      { error: "This action needs a database connection.", code: "DATABASE_UNAVAILABLE" },
      { status: 503 },
    );
  }

  console.error("Unhandled API error", error);
  return NextResponse.json({ error: "Something went wrong.", code: "INTERNAL_ERROR" }, { status: 500 });
}

export async function readJson<T>(request: Request, maxBytes = 128_000): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  const body = await request.text();
  if (body.length > maxBytes) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }
  if (!body) throw new HttpError(400, "INVALID_JSON", "A JSON request body is required.");

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
}

export function requireObject(value: unknown, message = "The request body must be an object.") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "INVALID_REQUEST", message);
  }
  return value as Record<string, unknown>;
}

export function stringField(
  value: unknown,
  name: string,
  options: { required?: boolean; max?: number } = {},
) {
  const required = options.required ?? true;
  if (typeof value !== "string") {
    if (!required && (value === undefined || value === null)) return undefined;
    throw new HttpError(400, "INVALID_REQUEST", `${name} must be a string.`);
  }
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, "INVALID_REQUEST", `${name} is required.`);
  if (options.max && trimmed.length > options.max) {
    throw new HttpError(400, "INVALID_REQUEST", `${name} must be at most ${options.max} characters.`);
  }
  return trimmed || undefined;
}

/**
 * Passwords are intentionally not trimmed: leading or trailing spaces can be
 * part of a user's credential. bcrypt accepts only the first 72 UTF-8 bytes,
 * so reject longer values rather than silently treating different passwords as
 * identical.
 */
export function passwordField(value: unknown, name = "password") {
  if (typeof value !== "string") throw new HttpError(400, "INVALID_REQUEST", `${name} must be a string.`);
  if (!value.length) throw new HttpError(400, "INVALID_REQUEST", `${name} is required.`);
  if (Buffer.byteLength(value, "utf8") > 72) {
    throw new HttpError(400, "INVALID_REQUEST", `${name} must be at most 72 UTF-8 bytes.`);
  }
  return value;
}

export function integerField(
  value: unknown,
  name: string,
  options: { min?: number; max?: number; required?: boolean } = {},
) {
  const required = options.required ?? true;
  if (value === undefined || value === null) {
    if (!required) return undefined;
    throw new HttpError(400, "INVALID_REQUEST", `${name} is required.`);
  }
  if (!Number.isInteger(value)) throw new HttpError(400, "INVALID_REQUEST", `${name} must be an integer.`);
  const number = value as number;
  if (options.min !== undefined && number < options.min) {
    throw new HttpError(400, "INVALID_REQUEST", `${name} must be at least ${options.min}.`);
  }
  if (options.max !== undefined && number > options.max) {
    throw new HttpError(400, "INVALID_REQUEST", `${name} must be at most ${options.max}.`);
  }
  return number;
}

/** Blocks cross-site browser POSTs while allowing server-to-server calls. */
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const requestUrl = new URL(request.url);

  // `next dev` commonly serves a local preview through either localhost or
  // 127.0.0.1. Treat those two loopback aliases as the same *only* in local
  // development, while preserving an exact-origin check everywhere else.
  if (process.env.NODE_ENV !== "production") {
    const originUrl = new URL(origin);
    const configuredUrl = requestUrl;
    const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (
      loopbackHosts.has(originUrl.hostname) &&
      loopbackHosts.has(configuredUrl.hostname) &&
      originUrl.port === configuredUrl.port
    ) {
      return;
    }
  }

  // Compare to the origin that actually received the request. This supports
  // Vercel's production and preview aliases even when APP_URL is stale, while
  // still rejecting browser POSTs initiated from a different site.
  if (origin !== requestUrl.origin) {
    // Vercel can forward a request to a deployment alias different from the
    // browser's public alias. The browser-generated Fetch Metadata signal is
    // still authoritative for an actual same-origin navigation or fetch.
    if (request.headers.get("sec-fetch-site") === "same-origin") return;
    throw new HttpError(403, "CROSS_SITE_REQUEST", "This request must come from this application.");
  }
}

export function appUrl(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? process.env.NEXTAUTH_URL;
  if (configured) return new URL(configured).origin;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

/** Prevents checkout redirects to an arbitrary origin. */
export function safeReturnUrl(candidate: unknown, fallbackPath: string, request?: Request) {
  const base = appUrl(request);
  if (typeof candidate === "string") {
    try {
      const parsed = new URL(candidate, base);
      if (parsed.origin === base) return parsed.toString();
    } catch {
      // Fall through to the local, known-safe URL.
    }
  }
  return new URL(fallbackPath, base).toString();
}

export const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
};
