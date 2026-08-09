import { NextResponse } from "next/server";

import { MFA_PENDING_COOKIE, mfaPendingCookieOptions, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { errorResponse, requireSameOrigin } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    response.cookies.set(MFA_PENDING_COOKIE, "", { ...mfaPendingCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
