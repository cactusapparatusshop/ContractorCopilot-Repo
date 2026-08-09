import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { isDemoMode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/http";
import { getStripeClient, subscriptionStatus } from "@/lib/stripe";

export const runtime = "nodejs";

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  if (!prisma) throw new HttpError(503, "DATABASE_UNAVAILABLE", "The webhook database is not configured.");
  const customerId = stripeId(subscription.customer);
  const metadataCompanyId = subscription.metadata?.companyId;
  const company = metadataCompanyId
    ? await prisma.company.findUnique({ where: { id: metadataCompanyId }, select: { id: true } })
    : customerId
      ? await prisma.company.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } })
      : null;
  if (!company) return false;

  if (customerId) {
    await prisma.company.update({ where: { id: company.id }, data: { stripeCustomerId: customerId } });
  }
  await prisma.subscription.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      plan: "PRO",
      status: subscriptionStatus(subscription.status),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id,
      plan: "PRO",
      status: subscriptionStatus(subscription.status),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
  return true;
}

async function markCheckoutPayment(session: Stripe.Checkout.Session, status: "PAID" | "FAILED" | "CANCELED") {
  if (!prisma) throw new HttpError(503, "DATABASE_UNAVAILABLE", "The webhook database is not configured.");
  const paymentIntentId = stripeId(session.payment_intent);
  await prisma.payment.updateMany({
    where: { stripeCheckoutSessionId: session.id },
    data: {
      status,
      ...(status === "PAID" ? { paidAt: new Date() } : {}),
      ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    },
  });
}

async function handleEvent(event: Stripe.Event) {
  if (!prisma) throw new HttpError(503, "DATABASE_UNAVAILABLE", "The webhook database is not configured.");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "payment" && session.metadata?.paymentType === "DEPOSIT") {
        await markCheckoutPayment(session, "PAID");
      }
      if (session.mode === "subscription") {
        const companyId = session.metadata?.companyId;
        const customerId = stripeId(session.customer);
        if (companyId && customerId) {
          await prisma.company.updateMany({ where: { id: companyId }, data: { stripeCustomerId: customerId } });
        }
        const subscriptionId = stripeId(session.subscription);
        const stripe = getStripeClient();
        if (subscriptionId && stripe) await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
      }
      return;
    }
    case "checkout.session.async_payment_failed":
      await markCheckoutPayment(event.data.object as Stripe.Checkout.Session, "FAILED");
      return;
    case "checkout.session.expired":
      await markCheckoutPayment(event.data.object as Stripe.Checkout.Session, "CANCELED");
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      return;
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = stripeId(invoice.customer);
      if (customerId) {
        await prisma.subscription.updateMany({
          where: { company: { stripeCustomerId: customerId } },
          data: { status: "PAST_DUE" },
        });
      }
      return;
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = stripeId((invoice as Stripe.Invoice & { subscription?: string | { id: string } | null }).subscription);
      const stripe = getStripeClient();
      if (subscriptionId && stripe) await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
      return;
    }
    default:
      return;
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 1_000_000) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Webhook payload is too large.");
    const payload = await request.text();
    if (payload.length > 1_000_000) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Webhook payload is too large.");

    const stripe = getStripeClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!stripe || !secret) {
      if (isDemoMode()) return NextResponse.json({ received: true, demo: true });
      throw new HttpError(503, "WEBHOOK_UNAVAILABLE", "Stripe webhooks are not configured.");
    }
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new HttpError(400, "INVALID_SIGNATURE", "A Stripe signature is required.");

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new HttpError(400, "INVALID_SIGNATURE", "The Stripe webhook signature is invalid.");
    }

    await handleEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    return errorResponse(error);
  }
}
