import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { isProposalLayout } from "@/lib/proposal-layouts";

export const runtime = "nodejs";

type ProposalActionRequest = { action?: unknown; layout?: unknown; customerCompanyName?: unknown; customerLogoDataUrl?: unknown; showCustomerLogo?: unknown };

export async function POST(request: Request, context: { params: Promise<{ proposalId: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { proposalId } = await context.params;
    if (!proposalId || proposalId.length > 80) throw new HttpError(400, "INVALID_REQUEST", "The proposal ID is invalid.");
    if (user.isDemo || !prisma) throw new HttpError(503, "PROPOSALS_UNAVAILABLE", "Proposal actions are unavailable in the preview workspace.");
    const body = await readJson<ProposalActionRequest>(request);
    const action = stringField(body.action, "action", { max: 32 });
    const proposal = await prisma.proposal.findFirst({ where: { id: proposalId, company: { memberships: { some: { userId: user.id } } } }, select: { id: true, companyId: true, status: true, publicToken: true, layout: true } });
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
    if (action === "set_layout") {
      if (!isProposalLayout(body.layout)) throw new HttpError(400, "INVALID_REQUEST", "Choose a valid proposal layout.");
      const updated = await prisma.proposal.update({ where: { id: proposal.id }, data: { layout: body.layout }, select: { layout: true } });
      await prisma.auditLog.create({ data: { companyId: proposal.companyId, actorId: user.id, action: "PROPOSAL_LAYOUT_CHANGED", entity: "Proposal", entityId: proposal.id, metadata: { layout: updated.layout } } });
      return NextResponse.json({ layout: updated.layout, message: "Proposal presentation updated." });
    }
    if (action === "set_customer_brand") {
      const customerCompanyName = stringField(body.customerCompanyName, "customerCompanyName", { required: false, max: 160 }) ?? null;
      const customerLogoDataUrl = stringField(body.customerLogoDataUrl, "customerLogoDataUrl", { required: false, max: 110_000 }) ?? null;
      if (customerLogoDataUrl && !/^data:image\/(?:jpeg|png);base64,[a-z0-9+/=]+$/i.test(customerLogoDataUrl)) throw new HttpError(400, "INVALID_REQUEST", "Use a JPG or PNG customer logo.");
      if (typeof body.showCustomerLogo !== "boolean") throw new HttpError(400, "INVALID_REQUEST", "showCustomerLogo must be a boolean.");
      const updated = await prisma.proposal.update({ where: { id: proposal.id }, data: { customerCompanyName, customerLogoDataUrl, showCustomerLogo: customerLogoDataUrl ? body.showCustomerLogo : false }, select: { customerCompanyName: true, customerLogoDataUrl: true, showCustomerLogo: true } });
      await prisma.auditLog.create({ data: { companyId: proposal.companyId, actorId: user.id, action: "PROPOSAL_CUSTOMER_BRAND_CHANGED", entity: "Proposal", entityId: proposal.id, metadata: { showCustomerLogo: updated.showCustomerLogo } } });
      return NextResponse.json(updated);
    }
    throw new HttpError(400, "INVALID_REQUEST", "Choose a valid proposal action.");
  } catch (error) {
    return errorResponse(error);
  }
}
