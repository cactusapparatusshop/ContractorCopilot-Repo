import { NextResponse } from "next/server";

import { generateEstimateDraft, type EstimateGenerationInput } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { getCompanyForUser, prisma, userCanAccessJob } from "@/lib/db";
import { requireEntitlement } from "@/lib/entitlements";
import { errorResponse, HttpError, integerField, privateNoStoreHeaders, readJson, requireObject, requireSameOrigin, stringField } from "@/lib/http";
import { calculateEstimate, type EstimateLineItemInput, type PricingSettings } from "@/lib/pricing";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type EstimateRequest = {
  title?: unknown;
  trade?: unknown;
  jobDescription?: unknown;
  measurements?: unknown;
  voiceTranscript?: unknown;
  photoSummaries?: unknown;
  pricing?: unknown;
  jobId?: unknown;
  save?: unknown;
  manualPricing?: unknown;
};

function photoSummaries(value: unknown) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 12) {
    throw new HttpError(400, "INVALID_REQUEST", "photoSummaries must have at most 12 entries.");
  }
  return value.map((summary, index) => stringField(summary, `photoSummaries[${index}]`, { max: 600 })!);
}

function requestPricing(value: unknown) {
  if (value === undefined || value === null) return {};
  const pricing = requireObject(value, "pricing must be an object.");
  return {
    markupBps: integerField(pricing.markupBps, "pricing.markupBps", { required: false, min: 0, max: 100_000 }),
    taxRateBps: integerField(pricing.taxRateBps, "pricing.taxRateBps", { required: false, min: 0, max: 25_000 }),
    currency: stringField(pricing.currency, "pricing.currency", { required: false, max: 3 })?.toLowerCase(),
  };
}

type ManualPricing = {
  materials?: string;
  materialCostCents?: number;
  laborHours?: number;
  laborRateCents?: number;
};

function decimalField(value: unknown, name: string, maximum: number) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    throw new HttpError(400, "INVALID_REQUEST", `${name} must be a number between 0 and ${maximum}.`);
  }
  return value;
}

function manualPricing(value: unknown): ManualPricing {
  if (value === undefined || value === null) return {};
  const pricing = requireObject(value, "manualPricing must be an object.");
  return {
    materials: stringField(pricing.materials, "manualPricing.materials", { required: false, max: 4_000 }),
    materialCostCents: integerField(pricing.materialCostCents, "manualPricing.materialCostCents", { required: false, min: 0, max: 100_000_000 }),
    laborHours: decimalField(pricing.laborHours, "manualPricing.laborHours", 1_000_000),
    laborRateCents: integerField(pricing.laborRateCents, "manualPricing.laborRateCents", { required: false, min: 0, max: 10_000_000 }),
  };
}

function lineItemDescription(value: string | undefined, fallback: string) {
  const description = value?.replace(/\s+/g, " ").trim();
  if (!description) return fallback;
  if (description.length <= 240) return description;

  const shortened = description.slice(0, 239);
  const lastWordBoundary = shortened.lastIndexOf(" ");
  return `${(lastWordBoundary > 80 ? shortened.slice(0, lastWordBoundary) : shortened).trimEnd()}…`;
}

function applyManualPricing(items: EstimateLineItemInput[], input: ManualPricing, trade?: string) {
  const hasMaterials = Boolean(input.materials) || input.materialCostCents !== undefined;
  const hasLabor = input.laborHours !== undefined || input.laborRateCents !== undefined;
  const result = items.filter((item) => !(hasMaterials && item.category === "MATERIAL") && !(hasLabor && item.category === "LABOR"));
  if (hasMaterials) {
    result.unshift({
      category: "MATERIAL",
      description: lineItemDescription(input.materials, "Materials allowance"),
      quantity: 1,
      unit: "allowance",
      unitCostCents: input.materialCostCents ?? 0,
      taxable: true,
    });
  }
  if (hasLabor && (input.laborHours ?? 0) > 0) {
    result.push({
      category: "LABOR",
      description: `${trade || "Project"} labor`,
      quantity: input.laborHours ?? 0,
      unit: "hour",
      unitCostCents: input.laborRateCents ?? 0,
      taxable: false,
    });
  }
  return result;
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    await requireEntitlement(user, "ai_estimates");
    const limit = takeRateLimit(`estimate:${user.id}`, 12, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Please wait a moment before generating another estimate.", code: "RATE_LIMITED" },
        { status: 429, headers: { ...privateNoStoreHeaders, "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
      );
    }

    const body = await readJson<EstimateRequest>(request);
    const jobDescription = stringField(body.jobDescription, "jobDescription", { max: 6_000 })!;
    const input: EstimateGenerationInput = {
      title: stringField(body.title, "title", { required: false, max: 160 }),
      trade: stringField(body.trade, "trade", { required: false, max: 80 }),
      jobDescription,
      measurements: stringField(body.measurements, "measurements", { required: false, max: 3_000 }),
      voiceTranscript: stringField(body.voiceTranscript, "voiceTranscript", { required: false, max: 6_000 }),
      photoSummaries: photoSummaries(body.photoSummaries),
    };
    const jobId = stringField(body.jobId, "jobId", { required: false, max: 80 });
    const manual = manualPricing(body.manualPricing);
    const save = body.save === true;
    if (body.save !== undefined && typeof body.save !== "boolean") {
      throw new HttpError(400, "INVALID_REQUEST", "save must be a boolean.");
    }

    let companyDefaults: PricingSettings = { markupBps: 2500, taxRateBps: 0, currency: "usd" };
    let companyId: string | undefined;
    let proposalDefaults = { depositPercent: 30, validityDays: 14, warrantyText: "" };
    if (prisma && !user.isDemo) {
      const company = await getCompanyForUser(user.id, user.companyId);
      if (company) {
        companyId = company.id;
        companyDefaults = {
          markupBps: company.defaultMarkupBps,
          taxRateBps: company.taxRateBps,
          currency: company.currency,
        };
        proposalDefaults = {
          depositPercent: company.defaultDepositPercent,
          validityDays: company.defaultProposalValidityDays,
          warrantyText: company.defaultWarrantyText ?? "",
        };
      }
    }

    if (jobId && prisma && !user.isDemo) {
      const job = await userCanAccessJob(user.id, jobId);
      if (!job) throw new HttpError(404, "JOB_NOT_FOUND", "That job was not found in your company.");
      companyId = job.companyId;
    }

    const overrides = requestPricing(body.pricing);
    const pricing: PricingSettings = {
      markupBps: overrides.markupBps ?? companyDefaults.markupBps,
      taxRateBps: overrides.taxRateBps ?? companyDefaults.taxRateBps,
      currency: overrides.currency ?? companyDefaults.currency,
    };
    if (!/^[a-z]{3}$/.test(pricing.currency ?? "")) {
      throw new HttpError(400, "INVALID_REQUEST", "pricing.currency must be a three-letter currency code.");
    }

    const draft = await generateEstimateDraft(input);
    const siteNotes = input.jobDescription.replace(/^site notes:\s*/i, "").split(/\n\s*\nmaterials:/i)[0]?.trim();
    const scopeAddendum = `${siteNotes ? ` Site notes: ${siteNotes}.` : ""}${manual.materials ? ` Materials specified by the contractor: ${manual.materials}.` : ""}`;
    const adjustedDraft = {
      ...draft,
      scopeOfWork: `${draft.scopeOfWork}${scopeAddendum}`.slice(0, 4_000),
      items: applyManualPricing(draft.items, manual, input.trade),
    };
    let summary;
    try {
      summary = calculateEstimate(adjustedDraft.items, pricing);
    } catch (error) {
      throw new HttpError(422, "UNPRICEABLE_DRAFT", error instanceof Error ? error.message : "The estimate draft could not be priced.");
    }

    let estimateId: string | undefined;
    let proposalId: string | undefined;
    let proposalToken: string | undefined;
    let persisted = false;
    if (save && prisma && companyId && jobId && !user.isDemo) {
      const created = await prisma.$transaction(async (db) => {
        const latest = await db.estimate.aggregate({ where: { companyId }, _max: { number: true } });
        const validUntil = new Date(Date.now() + proposalDefaults.validityDays * 24 * 60 * 60 * 1_000);
        const estimate = await db.estimate.create({
          data: {
            companyId,
            jobId,
            createdById: user.id,
            number: (latest._max.number ?? 0) + 1,
            title: input.title ?? "AI estimate draft",
            scopeOfWork: adjustedDraft.scopeOfWork,
            assumptions: adjustedDraft.assumptions.join("\n") || null,
            exclusions: adjustedDraft.exclusions.join("\n") || null,
            validUntil,
            status: "READY",
            currency: summary.currency,
            materialSubtotalCents: summary.materialSubtotalCents,
            laborSubtotalCents: summary.laborSubtotalCents,
            equipmentSubtotalCents: summary.equipmentSubtotalCents,
            disposalSubtotalCents: summary.disposalSubtotalCents,
            otherSubtotalCents: summary.otherSubtotalCents,
            markupCents: summary.markupCents,
            taxCents: summary.taxCents,
            totalCents: summary.totalCents,
            aiMetadata: { source: adjustedDraft.source, warnings: adjustedDraft.warnings, manualPricing: manual },
            items: {
              create: summary.lineItems.map((item, sortOrder) => ({
                category: item.category,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitCostCents: item.unitCostCents,
                unitPriceCents: item.unitPriceCents,
                taxable: item.taxable ?? false,
                sortOrder,
              })),
            },
          },
          select: { id: true, totalCents: true },
        });
        const proposal = await db.proposal.create({
          data: {
            companyId,
            estimateId: estimate.id,
            terms: proposalDefaults.warrantyText || null,
            depositAmountCents: Math.round((estimate.totalCents * proposalDefaults.depositPercent) / 100),
            expiresAt: validUntil,
          },
          select: { id: true, publicToken: true },
        });
        return { estimate, proposal };
      });
      estimateId = created.estimate.id;
      proposalId = created.proposal.id;
      proposalToken = created.proposal.publicToken;
      persisted = true;
    }

    return NextResponse.json(
      {
        draft: adjustedDraft,
        pricing: summary,
        estimateId,
        proposalId,
        proposalToken,
        persisted,
        persistenceHint:
          save && !persisted
            ? "Connect a database, create a job, and sign in with a non-demo account to save this estimate."
            : undefined,
      },
      { headers: privateNoStoreHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
