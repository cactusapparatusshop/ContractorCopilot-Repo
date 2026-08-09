import { generateProposalPdf, proposalPdfFileName } from "@/lib/pdf";
import { proposalCreationFingerprint, proposalPdfDataFromRequest } from "@/lib/proposals";
import { requireUser } from "@/lib/auth";
import { claimDocumentCreation } from "@/lib/entitlements";
import { errorResponse, readJson, requireSameOrigin } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const body = await readJson<{ proposal?: unknown }>(request, 180_000);
    const proposal = proposalPdfDataFromRequest(body.proposal);
    const pdf = await generateProposalPdf(proposal);
    const creation = await claimDocumentCreation(user, {
      kind: "PROPOSAL",
      sourceId: proposalCreationFingerprint(proposal),
    });
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
