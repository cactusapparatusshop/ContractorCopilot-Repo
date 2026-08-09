import { generateProposalPdf, proposalPdfFileName } from "@/lib/pdf";
import { publicProposalDataForToken, publicProposalPdfData } from "@/lib/proposals";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

/** Customer-safe PDF download bound to the same opaque proposal token. */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const proposal = await publicProposalDataForToken(token);
    if (!proposal) throw new HttpError(404, "PROPOSAL_NOT_FOUND", "This proposal link is not valid.");
    const pdfData = publicProposalPdfData(proposal);
    const pdf = await generateProposalPdf(pdfData);
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new Response(body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${proposalPdfFileName(pdfData.jobTitle)}"`, "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return errorResponse(error);
  }
}
