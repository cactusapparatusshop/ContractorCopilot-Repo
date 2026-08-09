import { generateProposalPdf, proposalPdfFileName } from "@/lib/pdf";
import { proposalPdfDataForUser } from "@/lib/proposals";
import { requireUser } from "@/lib/auth";
import { claimDocumentCreation } from "@/lib/entitlements";
import { errorResponse, HttpError } from "@/lib/http";
import { isDemoMode } from "@/lib/auth";
import { demoProposalPdfData } from "@/lib/demo-proposal";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ proposalId: string }> },
) {
  try {
    const user = await requireUser();
    const { proposalId } = await context.params;
    if (!proposalId || proposalId.length > 80) {
      throw new HttpError(400, "INVALID_REQUEST", "The proposal ID is invalid.");
    }
    const proposal = isDemoMode() && (proposalId === "est_1048" || proposalId === "EST-1048" || proposalId === "demo-proposal")
      ? demoProposalPdfData
      : await proposalPdfDataForUser(proposalId, user.id);
    if (!proposal) throw new HttpError(404, "PROPOSAL_NOT_FOUND", "That proposal was not found.");
    const creation = await claimDocumentCreation(user, { kind: "PROPOSAL", sourceId: `proposal:${proposalId}` });
    const pdf = await generateProposalPdf(proposal);
    // Fetch's BodyInit is stricter than pdf-lib's Uint8Array generic in TS 5.9.
    const pdfBody = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;

    return new Response(pdfBody, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${proposalPdfFileName(proposal.jobTitle)}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-ContractorCopilot-Plan": creation.plan,
        ...(creation.freeDocumentCreationsRemaining === null
          ? {}
          : { "X-ContractorCopilot-Free-Creations-Remaining": String(creation.freeDocumentCreationsRemaining) }),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
