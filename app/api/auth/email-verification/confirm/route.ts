import { NextResponse } from "next/server";

import { consumeAccountToken } from "@/lib/account-tokens";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";

export const runtime = "nodejs";

type ConfirmRequest = { token?: unknown };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<ConfirmRequest>(request);
    const token = stringField(body.token, "token", { max: 256 })!;
    const userId = await consumeAccountToken("verify-email", token);
    if (!userId || !prisma) throw new HttpError(400, "INVALID_OR_EXPIRED_TOKEN", "This verification link is invalid or has expired.");
    await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
    return NextResponse.json({ verified: true });
  } catch (error) {
    return errorResponse(error);
  }
}
