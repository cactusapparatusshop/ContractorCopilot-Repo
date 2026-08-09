import { NextResponse } from "next/server";

import { createSessionToken, demoUser, isDemoMode, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { errorResponse, requireSameOrigin } from "@/lib/http";

export const runtime = "nodejs";

/** Local/demo-only convenience route. A real deployment should issue the same signed session after OAuth/password auth. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!isDemoMode()) {
      return NextResponse.json({ error: "Demo sign-in is disabled.", code: "NOT_FOUND" }, { status: 404 });
    }

    const response = NextResponse.json({ user: demoUser, mode: "demo" });
    response.cookies.set(SESSION_COOKIE, createSessionToken(demoUser), sessionCookieOptions);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
