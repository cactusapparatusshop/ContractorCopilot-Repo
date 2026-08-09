import "server-only";

import Stripe from "stripe";

/** ContractorCopilot has one paid tier: Pro at $49.99/month. */
export type SubscriptionPlan = "pro";
export const PRO_MONTHLY_PRICE_CENTS = 4_999;
/** Pro starts with a single, card-backed 14-day trial at checkout. */
export const PRO_TRIAL_DAYS = 14;

declare global {
  // eslint-disable-next-line no-var
  var contractorCopilotStripe: Stripe | undefined;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeClient(): Stripe | null {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return null;

  if (!globalThis.contractorCopilotStripe) {
    globalThis.contractorCopilotStripe = new Stripe(secret);
  }
  return globalThis.contractorCopilotStripe;
}

export function getPlanPriceId(plan: SubscriptionPlan) {
  const priceId = process.env.STRIPE_PRICE_PRO ?? process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!priceId) throw new Error(`A Stripe price ID has not been configured for the ${plan} plan.`);
  return priceId;
}

/** Refuse a misconfigured checkout rather than charging a different amount. */
export async function verifyProMonthlyPrice(stripe: Stripe, priceId: string) {
  const price = await stripe.prices.retrieve(priceId);
  const isExpectedPrice =
    !price.deleted &&
    price.active &&
    price.currency.toLowerCase() === "usd" &&
    price.unit_amount === PRO_MONTHLY_PRICE_CENTS &&
    price.recurring?.interval === "month" &&
    price.recurring.interval_count === 1;
  if (!isExpectedPrice) {
    throw new Error("STRIPE_PRICE_PRO_MONTHLY must be an active USD recurring monthly price for $49.99.");
  }
}

export function subscriptionStatus(status: Stripe.Subscription.Status) {
  const map: Record<Stripe.Subscription.Status, "INCOMPLETE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" | "PAUSED"> = {
    incomplete: "INCOMPLETE",
    incomplete_expired: "CANCELED",
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    unpaid: "UNPAID",
    paused: "PAUSED",
  };
  return map[status] ?? "INCOMPLETE";
}
