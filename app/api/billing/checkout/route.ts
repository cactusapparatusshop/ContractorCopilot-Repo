import { NextResponse } from "next/server";

import { requireUser, isDemoMode } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { appUrl, errorResponse, HttpError, privateNoStoreHeaders, readJson, requireSameOrigin, safeReturnUrl } from "@/lib/http";
import { getPlanPriceId, getStripeClient, PRO_TRIAL_DAYS, type SubscriptionPlan, verifyProMonthlyPrice } from "@/lib/stripe";

export const runtime = "nodejs";

type CheckoutRequest = { plan?: unknown; successUrl?: unknown; cancelUrl?: unknown };

function planFrom(value: unknown): SubscriptionPlan {
  // Accept legacy UI values while always charging the single Pro price. This
  // keeps older client bundles working during a rolling deployment.
  if (value === "starter" || value === "pro" || value === "scale") return "pro";
  throw new HttpError(400, "INVALID_PLAN", "Choose the ContractorCopilot Pro plan.");
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const body = await readJson<CheckoutRequest>(request);
    const plan = planFrom(body.plan);
    const successUrl = safeReturnUrl(body.successUrl, "/billing?checkout=success", request);
    const cancelUrl = safeReturnUrl(body.cancelUrl, "/pricing?checkout=canceled", request);

    const stripe = getStripeClient();
    if (!stripe || !prisma) {
      if (isDemoMode()) {
        const url = new URL(successUrl || appUrl(request));
        url.searchParams.set("demo", "subscription");
        return NextResponse.json({ url: url.toString(), checkoutUrl: url.toString(), demo: true }, { headers: privateNoStoreHeaders });
      }
      throw new HttpError(503, "BILLING_UNAVAILABLE", "Billing has not been configured yet.");
    }

    const company = await getCompanyForUser(user.id, user.companyId);
    if (!company) throw new HttpError(403, "COMPANY_ACCESS_REQUIRED", "Select a company before starting a subscription.");
    const priceId = getPlanPriceId(plan);
    try {
      await verifyProMonthlyPrice(stripe, priceId);
    } catch {
      throw new HttpError(503, "INVALID_PRO_PRICE", "The ContractorCopilot Pro price is not configured for $49.99/month.");
    }
    const successWithSession = new URL(successUrl);
    successWithSession.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    const previousSubscription = await prisma.subscription.findUnique({ where: { companyId: company.id }, select: { stripeSubscriptionId: true, status: true } });
    if (previousSubscription?.stripeSubscriptionId && ["ACTIVE", "TRIALING"].includes(previousSubscription.status)) {
      throw new HttpError(409, "SUBSCRIPTION_ALREADY_ACTIVE", "This workspace already has Pro. Use the billing portal to manage your subscription.");
    }
    const startsTrial = !previousSubscription?.stripeSubscriptionId;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_collection: "always",
      ...(company.stripeCustomerId ? { customer: company.stripeCustomerId } : { customer_email: user.email }),
      client_reference_id: company.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successWithSession.toString(),
      cancel_url: cancelUrl,
      metadata: { companyId: company.id, userId: user.id, plan },
      subscription_data: {
        metadata: { companyId: company.id, plan },
        ...(startsTrial
          ? { trial_period_days: PRO_TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: "cancel" as const } } }
          : {}),
      },
    }, {
      // Deduplicates rapid double-clicks without permanently reusing an old
      // checkout session for a later, legitimate re-subscription.
      idempotencyKey: `contractorcopilot:pro:${company.id}:${priceId}:${Math.floor(Date.now() / (15 * 60_000))}`,
    });
    if (!session.url) throw new HttpError(502, "CHECKOUT_UNAVAILABLE", "Stripe did not return a checkout link.");

    return NextResponse.json({ url: session.url, checkoutUrl: session.url, demo: false }, { headers: privateNoStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
