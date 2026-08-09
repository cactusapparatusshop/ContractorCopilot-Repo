import { NextResponse } from "next/server";

import { isDemoMode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appUrl, errorResponse, HttpError, privateNoStoreHeaders, readJson, requireSameOrigin, safeReturnUrl, stringField } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

type DepositCheckoutRequest = { proposalToken?: unknown; successUrl?: unknown; cancelUrl?: unknown };

function platformFeeCents(amountCents: number) {
  const bps = Number(process.env.STRIPE_CONNECT_APPLICATION_FEE_BPS ?? 0);
  return Number.isInteger(bps) && bps > 0 && bps <= 10_000 ? Math.round((amountCents * bps) / 10_000) : 0;
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJson<DepositCheckoutRequest>(request);
    const proposalToken = stringField(body.proposalToken, "proposalToken", { max: 128 })!;
    const limit = takeRateLimit(`deposit:${proposalToken}`, 5, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Please wait a moment before trying again.", code: "RATE_LIMITED" },
        { status: 429, headers: { ...privateNoStoreHeaders, "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } },
      );
    }
    const successUrl = safeReturnUrl(body.successUrl, "/p/" + encodeURIComponent(proposalToken) + "?payment=success", request);
    const cancelUrl = safeReturnUrl(body.cancelUrl, "/p/" + encodeURIComponent(proposalToken) + "?payment=canceled", request);
    const stripe = getStripeClient();

    if (!prisma || !stripe) {
      if (isDemoMode()) {
        const demoUrl = new URL(successUrl, appUrl(request));
        demoUrl.searchParams.set("demo", "deposit");
        return NextResponse.json({ url: demoUrl.toString(), checkoutUrl: demoUrl.toString(), demo: true }, { headers: privateNoStoreHeaders });
      }
      throw new HttpError(503, "PAYMENTS_UNAVAILABLE", "Online deposit payments are not configured yet.");
    }

    const proposal = await prisma.proposal.findFirst({
      where: { publicToken: proposalToken },
      include: {
        company: true,
        estimate: { include: { job: { include: { customer: true } } } },
      },
    });
    if (!proposal) throw new HttpError(404, "PROPOSAL_NOT_FOUND", "This proposal link is not valid.");
    if (proposal.status !== "ACCEPTED") {
      throw new HttpError(409, "PROPOSAL_NOT_ACCEPTED", "Approve this proposal before paying the deposit.");
    }
    if (["DECLINED", "EXPIRED"].includes(proposal.status)) {
      throw new HttpError(409, "PROPOSAL_UNAVAILABLE", "This proposal is no longer available for payment.");
    }
    if (proposal.expiresAt && proposal.expiresAt < new Date()) {
      throw new HttpError(409, "PROPOSAL_EXPIRED", "This proposal has expired.");
    }
    const amountCents = proposal.depositAmountCents;
    if (!amountCents || amountCents <= 0 || amountCents > proposal.estimate.totalCents) {
      throw new HttpError(409, "DEPOSIT_UNAVAILABLE", "This proposal does not have a valid deposit amount.");
    }

    const successWithSession = new URL(successUrl);
    successWithSession.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    const customer = proposal.estimate.job?.customer;
    const connectedAccount = proposal.company.stripeConnectAccountId;
    if (!connectedAccount || !proposal.company.stripeConnectOnboardingComplete) {
      throw new HttpError(409, "CONNECT_ACCOUNT_REQUIRED", "The contractor has not finished setting up deposit payments yet.");
    }
    const applicationFee = platformFeeCents(amountCents);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: customer?.email ?? undefined,
        line_items: [
          {
            price_data: {
              currency: proposal.company.currency.toLowerCase(),
              product_data: { name: `Deposit — ${proposal.estimate.job?.title ?? proposal.estimate.title}` },
              unit_amount: amountCents,
            },
            quantity: 1,
          },
        ],
        success_url: successWithSession.toString(),
        cancel_url: cancelUrl,
        metadata: { companyId: proposal.companyId, proposalId: proposal.id, paymentType: "DEPOSIT" },
        payment_intent_data: {
          metadata: { companyId: proposal.companyId, proposalId: proposal.id, paymentType: "DEPOSIT" },
          transfer_data: { destination: connectedAccount },
          ...(applicationFee ? { application_fee_amount: applicationFee } : {}),
        },
      },
      { idempotencyKey: `proposal-${proposal.id}-deposit` },
    );
    if (!session.url) throw new HttpError(502, "CHECKOUT_UNAVAILABLE", "Stripe did not return a checkout link.");

    await prisma.payment.upsert({
      where: { stripeCheckoutSessionId: session.id },
      create: {
        companyId: proposal.companyId,
        proposalId: proposal.id,
        type: "DEPOSIT",
        status: "PENDING",
        amountCents,
        currency: proposal.company.currency.toLowerCase(),
        stripeCheckoutSessionId: session.id,
      },
      update: { amountCents, status: "PENDING" },
    });

    return NextResponse.json({ url: session.url, checkoutUrl: session.url, demo: false }, { headers: privateNoStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
