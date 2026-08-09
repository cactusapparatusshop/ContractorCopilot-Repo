import { NextResponse } from "next/server";

import { isDemoMode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/** Vercel Cron: marks unaccepted, expired proposals unavailable to customers. */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET?.trim();
    if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new HttpError(401, "UNAUTHORIZED", "Cron authorization is required.");
    }
    if (!secret && !isDemoMode()) throw new HttpError(503, "CRON_UNAVAILABLE", "CRON_SECRET must be configured in production.");
    if (!prisma) return NextResponse.json({ expired: 0, demo: true });

    const result = await prisma.proposal.updateMany({
      where: { status: { in: ["DRAFT", "SENT", "VIEWED"] }, expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
    return NextResponse.json({ expired: result.count, demo: false });
  } catch (error) {
    return errorResponse(error);
  }
}
