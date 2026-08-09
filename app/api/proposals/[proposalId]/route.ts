import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";

export const runtime = "nodejs";

type ProposalActionRequest = { action?: unknown };

export async function POST(request: Request, context: { params: Promise<{ proposalId: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { proposalId } = await context.params;
    if (!proposalId || proposalId.length > 80) throw new HttpError(400, "INVALID_REQUEST", "The proposal ID is invalid.");
    if (user.isDemo || !prisma) throw new HttpError(503, "PROPOSALS_UNAVAILABLE", "Proposal actions are unavailable in the preview workspace.");
    const body = await readJson<ProposalActionRequest>(request);
    const action = stringField(body.action, "action", { max: 32 });
    const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, company: { memberships: { some: { userId: user.id } } } }, select: { id: true, companyId: true, status: true, publicToken: true } });
    if (!proposal) throw new HttpError(404, "PROPOSAL_NOT_FOUND", "That proposal was not found in your workspace.");

    if (action === "send") {
      const updated = await prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: proposal.status === "DRAFT" ? "SENT" : proposal.status, sentAt: proposal.status === "DRAFT" ? new Date() : undefined },
        select: { status: true, publicToken: true },
      });
      await prisma.auditLog.create({ data: { companyId: proposal.companyId, actorId: user.id, action: "PROPOSAL_SENT", entity: "Proposal", entityId: proposal.id } });
      return NextResponse.json({ status: updated.status, publicToken: updated.publicToken, message: "Proposal is marked as sent. Copy the secure customer link to share it." });
    }
    if (action === "follow_up") {
      await prisma.auditLog.create({ data: { companyId: proposal.companyId, actorId: user.id, action: "FOLLOW_UP_REQUESTED", entity: "Proposal", entityId: proposal.id } });
      return NextResponse.json({ message: "Follow-up reminder saved to your proposal activity." });
    }
    throw new HttpError(400, "INVALID_REQUEST", "Choose a valid proposal action.");
  } catch (error) {
    return errorResponse(error);
  }
}
