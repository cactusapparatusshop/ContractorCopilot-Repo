import "server-only";

import { createHash } from "node:crypto";

import { isDemoMode } from "@/lib/auth";
import { prisma, requireDatabase } from "@/lib/db";
import { demoPublicProposal } from "@/lib/demo-proposal";
import { HttpError, integerField, requireObject, stringField } from "@/lib/http";
import type { ProposalPdfData, ProposalPdfLineItem } from "@/lib/pdf";
import { isProposalLayout, type ProposalLayout } from "@/lib/proposal-layouts";
import { proposalPhoto } from "@/lib/jobsite-photos";

function listOfStrings(value: unknown, field: string, maximumItems = 12, maximumLength = 600) {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new HttpError(400, "INVALID_REQUEST", `${field} must contain at most ${maximumItems} entries.`);
  }
  return value.map((entry) => stringField(entry, field, { max: maximumLength })!);
}

function lineItems(value: unknown): ProposalPdfLineItem[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) {
    throw new HttpError(400, "INVALID_REQUEST", "lineItems must contain between 1 and 100 items.");
  }

  return value.map((entry, index) => {
    const item = requireObject(entry, `lineItems[${index}] must be an object.`);
    const quantity = typeof item.quantity === "number" ? item.quantity : NaN;
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
      throw new HttpError(400, "INVALID_REQUEST", `lineItems[${index}].quantity must be a positive number.`);
    }

    return {
      description: stringField(item.description, `lineItems[${index}].description`, { max: 240 })!,
      quantity,
      unit: stringField(item.unit, `lineItems[${index}].unit`, { max: 40 })!,
      unitPriceCents: integerField(item.unitPriceCents, `lineItems[${index}].unitPriceCents`, { min: 0, max: 100_000_000 })!,
      lineTotalCents: integerField(item.lineTotalCents, `lineItems[${index}].lineTotalCents`, { min: 0, max: 100_000_000 })!,
    };
  });
}

/** Validates an ephemeral PDF payload without accepting arbitrary HTML. */
export function proposalPdfDataFromRequest(value: unknown): ProposalPdfData {
  const proposal = requireObject(value, "proposal must be an object.");
  const company = requireObject(proposal.company, "proposal.company must be an object.");
  const customer = requireObject(proposal.customer, "proposal.customer must be an object.");
  const job = requireObject(proposal.job, "proposal.job must be an object.");
  const totals = requireObject(proposal.totals, "proposal.totals must be an object.");
  const currency = stringField(totals.currency, "proposal.totals.currency", { required: false, max: 3 })?.toLowerCase();
  if (currency && !/^[a-z]{3}$/.test(currency)) {
    throw new HttpError(400, "INVALID_REQUEST", "proposal.totals.currency must be a three-letter currency code.");
  }

  return {
    proposalNumber: stringField(proposal.proposalNumber, "proposal.proposalNumber", { required: false, max: 80 }),
    companyName: stringField(company.name, "proposal.company.name", { max: 120 })!,
    companyEmail: stringField(company.email, "proposal.company.email", { required: false, max: 180 }),
    companyPhone: stringField(company.phone, "proposal.company.phone", { required: false, max: 60 }),
    companyAddress: stringField(company.address, "proposal.company.address", { required: false, max: 240 }),
    customerName: stringField(customer.name, "proposal.customer.name", { max: 160 })!,
    customerEmail: stringField(customer.email, "proposal.customer.email", { required: false, max: 180 }),
    jobTitle: stringField(job.title, "proposal.job.title", { max: 200 })!,
    jobAddress: stringField(job.address, "proposal.job.address", { required: false, max: 240 }),
    scopeOfWork: stringField(proposal.scopeOfWork, "proposal.scopeOfWork", { max: 4_000 })!,
    assumptions: listOfStrings(proposal.assumptions, "proposal.assumptions"),
    exclusions: listOfStrings(proposal.exclusions, "proposal.exclusions"),
    terms: stringField(proposal.terms, "proposal.terms", { required: false, max: 4_000 }),
    validUntil: stringField(proposal.validUntil, "proposal.validUntil", { required: false, max: 80 }),
    lineItems: lineItems(proposal.lineItems),
    subtotalCents: integerField(totals.subtotalCents, "proposal.totals.subtotalCents", { min: 0, max: 100_000_000 })!,
    markupCents: integerField(totals.markupCents, "proposal.totals.markupCents", { required: false, min: 0, max: 100_000_000 }),
    taxCents: integerField(totals.taxCents, "proposal.totals.taxCents", { required: false, min: 0, max: 100_000_000 }),
    totalCents: integerField(totals.totalCents, "proposal.totals.totalCents", { min: 0, max: 100_000_000 })!,
    depositAmountCents: integerField(proposal.depositAmountCents, "proposal.depositAmountCents", { required: false, min: 0, max: 100_000_000 }),
    currency,
    layout: isProposalLayout(proposal.layout) ? proposal.layout : "CLEAN",
  };
}

/**
 * A stable source ID for an ad-hoc PDF proposal. It makes double-clicks and
 * download retries idempotent for the free document allowance without storing
 * a customer-facing payload in the usage ledger.
 */
export function proposalCreationFingerprint(proposal: ProposalPdfData) {
  return `pdf_${createHash("sha256").update(JSON.stringify(proposal)).digest("hex")}`;
}

/** Loads a persisted proposal only if the requesting user belongs to its company. */
export async function proposalPdfDataForUser(proposalId: string, userId: string): Promise<ProposalPdfData | null> {
  const db = requireDatabase();
  const proposal = await db.proposal.findFirst({
    where: {
      id: proposalId,
      company: { memberships: { some: { userId } } },
    },
    include: {
      company: true,
      estimate: {
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          job: { include: { customer: true, assets: { where: { type: "PHOTO" }, orderBy: { createdAt: "asc" }, take: 4 } } },
        },
      },
    },
  });
  if (!proposal) return null;

  const customer = proposal.estimate.job?.customer;
  return {
    proposalNumber: `${proposal.estimate.number}`,
    companyName: proposal.company.name,
    companyEmail: proposal.company.email ?? undefined,
    companyPhone: proposal.company.phone ?? undefined,
    companyAddress: proposal.company.address ?? undefined,
    customerName: customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "Customer",
    customerEmail: customer?.email ?? undefined,
    jobTitle: proposal.estimate.job?.title ?? proposal.estimate.title,
    jobAddress: proposal.estimate.job?.address ?? undefined,
    scopeOfWork: proposal.estimate.scopeOfWork,
    assumptions: proposal.estimate.assumptions?.split("\n").filter(Boolean),
    exclusions: proposal.estimate.exclusions?.split("\n").filter(Boolean),
    terms: proposal.terms ?? undefined,
    validUntil: proposal.estimate.validUntil?.toLocaleDateString("en-US"),
    lineItems: proposal.estimate.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: Math.round(Number(item.quantity) * item.unitPriceCents),
    })),
    subtotalCents:
      proposal.estimate.materialSubtotalCents +
      proposal.estimate.laborSubtotalCents +
      proposal.estimate.equipmentSubtotalCents +
      proposal.estimate.disposalSubtotalCents +
      proposal.estimate.otherSubtotalCents,
    markupCents: proposal.estimate.markupCents,
    taxCents: proposal.estimate.taxCents,
    totalCents: proposal.estimate.totalCents,
    depositAmountCents: proposal.depositAmountCents ?? undefined,
    currency: proposal.estimate.currency,
    layout: proposal.layout,
    photos: (proposal.estimate.job?.assets ?? [])
      .map((asset) => proposalPhoto(asset.storageKey, asset.caption))
      .filter((photo): photo is { src: string; caption: string } => Boolean(photo)),
  };
}

export function databaseProposalSupportEnabled() {
  return Boolean(prisma);
}

export type PublicProposalData = {
  token: string;
  status: string;
  proposalNumber: string;
  createdAt?: string;
  company: { name: string; email?: string | null; phone?: string | null; address?: string | null };
  customer: { name: string; email?: string | null; address?: string | null };
  job: { title: string; address?: string | null };
  scopeOfWork: string;
  assumptions: string[];
  exclusions: string[];
  terms?: string | null;
  validUntil?: string;
  lineItems: ProposalPdfLineItem[];
  totals: { subtotalCents: number; markupCents: number; taxCents: number; totalCents: number; currency: string };
  depositAmountCents?: number | null;
  layout: ProposalLayout;
  photos: { src: string; caption: string }[];
  demo: boolean;
};

/** Gets a customer-safe, token-scoped proposal snapshot for the public portal. */
export async function publicProposalDataForToken(token: string): Promise<PublicProposalData | null> {
  if (!token || token.length > 128) return null;
  if (!prisma) {
    if (!isDemoMode()) return null;
    const demo = demoPublicProposal();
    return {
      token,
      status: demo.status,
      proposalNumber: demoProposalNumber(demo.job.title),
      company: demo.company,
      customer: { name: demo.customer.name, email: demo.customer.email, address: demo.job.address },
      job: demo.job,
      scopeOfWork: demo.scopeOfWork,
      assumptions: demo.assumptions ?? [],
      exclusions: demo.exclusions ?? [],
      terms: demo.terms,
      validUntil: demo.validUntil,
      lineItems: demo.lineItems,
      totals: { subtotalCents: demo.totals.subtotalCents ?? 0, markupCents: 0, taxCents: demo.totals.taxCents ?? 0, totalCents: demo.totals.totalCents ?? 0, currency: demo.totals.currency ?? "usd" },
      depositAmountCents: demo.depositAmountCents,
      layout: "CLEAN",
      photos: [],
      demo: true,
    };
  }

  const proposal = await prisma.proposal.findUnique({
    where: { publicToken: token },
    include: {
      company: { select: { name: true, email: true, phone: true, address: true } },
      estimate: { include: { items: { orderBy: { sortOrder: "asc" } }, job: { include: { customer: true, assets: { where: { type: "PHOTO" }, orderBy: { createdAt: "asc" }, take: 4 } } } } },
    },
  });
  if (!proposal || ["DECLINED", "EXPIRED"].includes(proposal.status) || (proposal.expiresAt && proposal.expiresAt < new Date())) return null;
  if (!proposal.viewedAt) {
    await prisma.proposal.update({ where: { id: proposal.id }, data: { viewedAt: new Date(), status: proposal.status === "SENT" ? "VIEWED" : proposal.status } });
  }
  const customer = proposal.estimate.job?.customer;
  const lineItems = proposal.estimate.items.map((item) => ({
    description: item.description,
    quantity: Number(item.quantity),
    unit: item.unit,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: Math.round(Number(item.quantity) * item.unitPriceCents),
  }));
  return {
    token,
    status: proposal.status,
    proposalNumber: String(proposal.estimate.number),
    createdAt: proposal.createdAt.toLocaleDateString("en-US"),
    company: proposal.company,
    customer: {
      name: customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "Customer",
      email: customer?.email,
      address: [customer?.address1, customer?.address2, [customer?.city, customer?.state, customer?.postalCode].filter(Boolean).join(" ")].filter(Boolean).join("\n") || undefined,
    },
    job: { title: proposal.estimate.job?.title ?? proposal.estimate.title, address: proposal.estimate.job?.address },
    scopeOfWork: proposal.estimate.scopeOfWork,
    assumptions: proposal.estimate.assumptions?.split("\n").filter(Boolean) ?? [],
    exclusions: proposal.estimate.exclusions?.split("\n").filter(Boolean) ?? [],
    terms: proposal.terms,
    validUntil: proposal.estimate.validUntil?.toLocaleDateString("en-US"),
    lineItems,
    totals: {
      subtotalCents: proposal.estimate.materialSubtotalCents + proposal.estimate.laborSubtotalCents + proposal.estimate.equipmentSubtotalCents + proposal.estimate.disposalSubtotalCents + proposal.estimate.otherSubtotalCents,
      markupCents: proposal.estimate.markupCents,
      taxCents: proposal.estimate.taxCents,
      totalCents: proposal.estimate.totalCents,
      currency: proposal.estimate.currency,
    },
    depositAmountCents: proposal.depositAmountCents,
    layout: proposal.layout,
    photos: (proposal.estimate.job?.assets ?? []).map((asset) => proposalPhoto(asset.storageKey, asset.caption)).filter((photo): photo is { src: string; caption: string } => Boolean(photo)),
    demo: false,
  };
}

function demoProposalNumber(_title: string) {
  return "EST-1048";
}

export function publicProposalPdfData(data: PublicProposalData): ProposalPdfData {
  return {
    proposalNumber: data.proposalNumber,
    companyName: data.company.name,
    companyEmail: data.company.email ?? undefined,
    companyPhone: data.company.phone ?? undefined,
    companyAddress: data.company.address ?? undefined,
    customerName: data.customer.name,
    customerEmail: data.customer.email ?? undefined,
    jobTitle: data.job.title,
    jobAddress: data.job.address ?? undefined,
    scopeOfWork: data.scopeOfWork,
    assumptions: data.assumptions,
    exclusions: data.exclusions,
    terms: data.terms ?? undefined,
    validUntil: data.validUntil,
    lineItems: data.lineItems,
    subtotalCents: data.totals.subtotalCents,
    markupCents: data.totals.markupCents,
    taxCents: data.totals.taxCents,
    totalCents: data.totals.totalCents,
    depositAmountCents: data.depositAmountCents ?? undefined,
    currency: data.totals.currency,
    layout: data.layout,
    photos: data.photos,
  };
}
