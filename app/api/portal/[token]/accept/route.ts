import { NextResponse } from "next/server";

import { isDemoMode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, privateNoStoreHeaders, readJson, requireSameOrigin, stringField } from "@/lib/http";

export const runtime = "nodejs";

type AcceptRequest = { signerName?: unknown; signerEmail?: unknown; acceptedTerms?: unknown };

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    requireSameOrigin(request);
    const { token } = await context.params;
    if (!token || token.length > 128) throw new HttpError(404, "PROPOSAL_NOT_FOUND", "This proposal link is not valid.");
    const body = await readJson<AcceptRequest>(request);
    const signerName = stringField(body.signerName, "signerName", { max: 160 })!;
    const signerEmail = stringField(body.signerEmail, "signerEmail", { max: 180 })!;
    if (!/^\S+@\S+\.\S+$/.test(signerEmail)) throw new HttpError(400, "INVALID_REQUEST", "signerEmail must be an email address.");
    if (body.acceptedTerms !== true) throw new HttpError(400, "TERMS_REQUIRED", "You must accept the proposal terms.");

    if (!prisma) {
      if (isDemoMode()) return NextResponse.json({ status: "ACCEPTED", demo: true }, { headers: privateNoStoreHeaders });
      throw new HttpError(503, "PORTAL_UNAVAILABLE", "The customer portal is not configured yet.");
    }
    const proposal = await prisma.proposal.findUnique({ where: { publicToken: token }, select: { id: true, companyId: true, status: true, expiresAt: true } });
    if (!proposal || ["DECLINED", "EXPIRED"].includes(proposal.status) || (proposal.expiresAt && proposal.expiresAt < new Date())) {
      throw new HttpError(404, "PROPOSAL_NOT_FOUND", "This proposal link is not valid.");
    }
    const acceptedAt = new Date();
    await prisma.$transaction([
      prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: "ACCEPTED", acceptedAt, acceptedByName: signerName, acceptedByEmail: signerEmail },
      }),
      prisma.auditLog.create({
        data: { companyId: proposal.companyId, action: "proposal.accepted", entity: "Proposal", entityId: proposal.id, metadata: { signerName, signerEmail } },
      }),
    ]);

    return NextResponse.json({ status: "ACCEPTED", acceptedAt: acceptedAt.toISOString(), demo: false }, { headers: privateNoStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
