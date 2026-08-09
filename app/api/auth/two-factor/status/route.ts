import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, privateNoStoreHeaders } from "@/lib/http";
import { isTwoFactorConfigured } from "@/lib/two-factor";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    if (user.isDemo || !prisma) throw new HttpError(503, "TWO_FACTOR_UNAVAILABLE", "Two-factor authentication is unavailable in the preview workspace.");
    const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorEnabledAt: true } });
    return NextResponse.json({ enabled: Boolean(stored?.twoFactorEnabledAt), available: isTwoFactorConfigured() }, { headers: privateNoStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
