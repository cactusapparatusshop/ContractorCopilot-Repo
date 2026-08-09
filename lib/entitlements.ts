import "server-only";

import type { AuthUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";

/** A company gets three total proposal/invoice creations before Pro is required. */
export const FREE_DOCUMENT_CREATION_LIMIT = 3;

export type BillableFeature = "ai_estimates" | "customer_payments";
export type DocumentCreationKind = "PROPOSAL" | "INVOICE";

export type BillingState = {
  companyId: string;
  plan: "demo" | "free" | "pro";
  freeDocumentCreationLimit: number;
  freeDocumentCreationsUsed: number;
  freeDocumentCreationsRemaining: number | null;
};

export type DocumentCreationClaim = BillingState & {
  kind: DocumentCreationKind;
  sourceId: string;
  alreadyClaimed: boolean;
};

function isActivePro(subscription: { status: string; plan: string; stripeSubscriptionId: string | null; stripePriceId: string | null } | null) {
  if (!subscription || !["ACTIVE", "TRIALING"].includes(subscription.status)) return false;

  // The Stripe identifiers keep existing paid customers entitled while a
  // deployment migrates the new `plan` column and awaits its next webhook.
  return subscription.plan === "PRO" || Boolean(subscription.stripeSubscriptionId || subscription.stripePriceId);
}

function remainingFreeCreations(used: number) {
  return Math.max(0, FREE_DOCUMENT_CREATION_LIMIT - used);
}

async function companyForBilling(user: AuthUser) {
  if (!prisma) throw new HttpError(503, "BILLING_UNAVAILABLE", "Billing has not been configured yet.");
  const company = await getCompanyForUser(user.id, user.companyId);
  if (!company) throw new HttpError(403, "COMPANY_ACCESS_REQUIRED", "Select a company before using this feature.");
  return company;
}

function demoBillingState(): BillingState {
  return {
    companyId: "demo-company",
    plan: "demo",
    freeDocumentCreationLimit: FREE_DOCUMENT_CREATION_LIMIT,
    freeDocumentCreationsUsed: 0,
    freeDocumentCreationsRemaining: null,
  };
}

/** Returns the company’s current plan and shared document-creation allowance. */
export async function getBillingState(user: AuthUser): Promise<BillingState> {
  if (user.isDemo) return demoBillingState();
  const company = await companyForBilling(user);
  const subscription = await prisma!.subscription.findUnique({
    where: { companyId: company.id },
    select: { status: true, plan: true, stripeSubscriptionId: true, stripePriceId: true },
  });
  const plan = isActivePro(subscription) ? "pro" : "free";
  const used = Math.min(Math.max(company.freeDocumentCreationsUsed, 0), FREE_DOCUMENT_CREATION_LIMIT);

  return {
    companyId: company.id,
    plan,
    freeDocumentCreationLimit: FREE_DOCUMENT_CREATION_LIMIT,
    freeDocumentCreationsUsed: used,
    freeDocumentCreationsRemaining: plan === "pro" ? null : remainingFreeCreations(used),
  };
}

/**
 * Free workspaces can still create jobs and AI estimate drafts. The document
 * creation guard below is the paid boundary: it is called at the point a
 * proposal or invoice is created, not merely when a user opens a screen.
 */
export async function requireEntitlement(user: AuthUser, _feature: BillableFeature) {
  return getBillingState(user);
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

/**
 * Atomically reserves one proposal/invoice creation. `sourceId` must be
 * stable for retries (a persisted document ID or content fingerprint), so a
 * download retry never consumes an additional free creation.
 */
export async function claimDocumentCreation(
  user: AuthUser,
  input: { kind: DocumentCreationKind; sourceId: string },
): Promise<DocumentCreationClaim> {
  if (!input.sourceId || input.sourceId.length > 160) {
    throw new HttpError(400, "INVALID_DOCUMENT_REFERENCE", "The document creation reference is invalid.");
  }
  if (user.isDemo) {
    return { ...demoBillingState(), kind: input.kind, sourceId: input.sourceId, alreadyClaimed: false };
  }

  const company = await companyForBilling(user);
  const findExistingClaim = async () => {
    const existing = await prisma!.documentCreation.findUnique({
      where: { companyId_kind_sourceId: { companyId: company.id, kind: input.kind, sourceId: input.sourceId } },
      select: { id: true, consumedFreeCreation: true },
    });
    if (!existing) return null;
    const state = await getBillingState(user);
    return { ...state, kind: input.kind, sourceId: input.sourceId, alreadyClaimed: true } satisfies DocumentCreationClaim;
  };

  try {
    return await prisma!.$transaction(async (db) => {
      const existing = await db.documentCreation.findUnique({
        where: { companyId_kind_sourceId: { companyId: company.id, kind: input.kind, sourceId: input.sourceId } },
        select: { id: true },
      });
      if (existing) {
        const currentCompany = await db.company.findUniqueOrThrow({
          where: { id: company.id },
          select: { freeDocumentCreationsUsed: true },
        });
        const subscription = await db.subscription.findUnique({
          where: { companyId: company.id },
          select: { status: true, plan: true, stripeSubscriptionId: true, stripePriceId: true },
        });
        const plan = isActivePro(subscription) ? "pro" : "free";
        const used = Math.min(Math.max(currentCompany.freeDocumentCreationsUsed, 0), FREE_DOCUMENT_CREATION_LIMIT);
        return {
          companyId: company.id,
          plan,
          freeDocumentCreationLimit: FREE_DOCUMENT_CREATION_LIMIT,
          freeDocumentCreationsUsed: used,
          freeDocumentCreationsRemaining: plan === "pro" ? null : remainingFreeCreations(used),
          kind: input.kind,
          sourceId: input.sourceId,
          alreadyClaimed: true,
        } satisfies DocumentCreationClaim;
      }

      const subscription = await db.subscription.findUnique({
        where: { companyId: company.id },
        select: { status: true, plan: true, stripeSubscriptionId: true, stripePriceId: true },
      });
      const isPro = isActivePro(subscription);
      let consumedFreeCreation = false;

      if (!isPro) {
        const updated = await db.company.updateMany({
          where: { id: company.id, freeDocumentCreationsUsed: { lt: FREE_DOCUMENT_CREATION_LIMIT } },
          data: { freeDocumentCreationsUsed: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            402,
            "FREE_DOCUMENT_LIMIT_REACHED",
            `Your ${FREE_DOCUMENT_CREATION_LIMIT} free proposal or invoice creations have been used. Upgrade to Pro for unlimited creations.`,
          );
        }
        consumedFreeCreation = true;
      }

      await db.documentCreation.create({
        data: {
          companyId: company.id,
          kind: input.kind,
          sourceId: input.sourceId,
          createdById: user.id,
          consumedFreeCreation,
        },
      });
      const currentCompany = await db.company.findUniqueOrThrow({
        where: { id: company.id },
        select: { freeDocumentCreationsUsed: true },
      });
      const used = Math.min(Math.max(currentCompany.freeDocumentCreationsUsed, 0), FREE_DOCUMENT_CREATION_LIMIT);

      return {
        companyId: company.id,
        plan: isPro ? "pro" : "free",
        freeDocumentCreationLimit: FREE_DOCUMENT_CREATION_LIMIT,
        freeDocumentCreationsUsed: used,
        freeDocumentCreationsRemaining: isPro ? null : remainingFreeCreations(used),
        kind: input.kind,
        sourceId: input.sourceId,
        alreadyClaimed: false,
      } satisfies DocumentCreationClaim;
    });
  } catch (error) {
    // A duplicated concurrent request rolls its transaction back. Return the
    // existing reservation so the original document is still available.
    if (isUniqueConstraintError(error)) {
      const existing = await findExistingClaim();
      if (existing) return existing;
    }
    throw error;
  }
}
