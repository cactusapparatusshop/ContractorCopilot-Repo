import "server-only";

import type { ProposalPdfData } from "@/lib/pdf";

export const demoProposalToken = "demo-proposal";

export const demoProposalPdfData: ProposalPdfData = {
  proposalNumber: "EST-1048",
  companyName: "Northstar Fencing Co.",
  companyEmail: "marcus@northstarfencing.com",
  companyPhone: "(512) 555-0194",
  companyAddress: "4012 South Lamar Blvd, Austin, TX 78704",
  customerName: "Olivia Martinez",
  customerEmail: "olivia.martinez@email.com",
  jobTitle: "Cedar privacy fence installation",
  jobAddress: "1809 Bluebonnet Lane, Austin, TX 78704",
  scopeOfWork: "Remove and dispose of the existing chain-link fence, then install 120 linear feet of 6-foot western red cedar privacy fencing with one 4-foot walk gate. Work includes concrete-set posts, exterior-rated fasteners, site cleanup, and a final walkthrough.",
  assumptions: ["Ground is mostly level.", "Access is available through the side gate.", "No permit is required."],
  exclusions: ["Unforeseen subsurface conditions, permits, and utility relocation unless specifically listed."],
  terms: "A 30% deposit reserves the installation date. The remaining balance is due at completion unless otherwise agreed in writing.",
  validUntil: "August 14, 2026",
  lineItems: [
    { description: "Remove existing chain-link fence", quantity: 120, unit: "LF", unitPriceCents: 600, lineTotalCents: 72_000 },
    { description: "6-foot cedar privacy fence", quantity: 120, unit: "LF", unitPriceCents: 3_250, lineTotalCents: 390_000 },
    { description: "4-foot cedar walk gate", quantity: 1, unit: "EA", unitPriceCents: 68_000, lineTotalCents: 68_000 },
    { description: "Post concrete, hardware & cleanup", quantity: 1, unit: "LOT", unitPriceCents: 49_573, lineTotalCents: 49_573 },
  ],
  subtotalCents: 579_573,
  taxCents: 58_527,
  totalCents: 638_100,
  depositAmountCents: 191_430,
  currency: "usd",
};

export function demoPublicProposal() {
  return {
    token: demoProposalToken,
    status: "VIEWED",
    company: {
      name: demoProposalPdfData.companyName,
      email: demoProposalPdfData.companyEmail,
      phone: demoProposalPdfData.companyPhone,
    },
    customer: {
      name: demoProposalPdfData.customerName,
      email: demoProposalPdfData.customerEmail,
    },
    job: { title: demoProposalPdfData.jobTitle, address: demoProposalPdfData.jobAddress },
    scopeOfWork: demoProposalPdfData.scopeOfWork,
    assumptions: demoProposalPdfData.assumptions,
    exclusions: demoProposalPdfData.exclusions,
    terms: demoProposalPdfData.terms,
    validUntil: demoProposalPdfData.validUntil,
    lineItems: demoProposalPdfData.lineItems,
    totals: {
      subtotalCents: demoProposalPdfData.subtotalCents,
      taxCents: demoProposalPdfData.taxCents,
      totalCents: demoProposalPdfData.totalCents,
      currency: demoProposalPdfData.currency,
    },
    depositAmountCents: demoProposalPdfData.depositAmountCents,
    demo: true,
  };
}
