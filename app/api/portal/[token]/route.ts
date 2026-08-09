import { NextResponse } from "next/server";

import { publicProposalDataForToken } from "@/lib/proposals";
import { errorResponse, HttpError, privateNoStoreHeaders } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const proposal = await publicProposalDataForToken(token);
    if (!proposal) throw new HttpError(404, "PROPOSAL_NOT_FOUND", "This proposal link is not valid.");
    return NextResponse.json(proposal, { headers: privateNoStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
