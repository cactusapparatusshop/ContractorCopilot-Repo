import { NextResponse } from "next/server";

import { requireUser, isDemoMode } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { errorResponse, HttpError, privateNoStoreHeaders, readJson, requireSameOrigin, safeReturnUrl } from "@/lib/http";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

type PortalRequest = { returnUrl?: unknown };

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const body = await readJson<PortalRequest>(request);
    const returnUrl = safeReturnUrl(body.returnUrl, "/billing", request);
    const stripe = getStripeClient();

    if (!stripe || !prisma) {
      if (isDemoMode()) {
        return NextResponse.json({ url: returnUrl, portalUrl: returnUrl, demo: true }, { headers: privateNoStoreHeaders });
      }
      throw new HttpError(503, "BILLING_UNAVAILABLE", "Billing has not been configured yet.");
    }

    const company = await getCompanyForUser(user.id, user.companyId);
    if (!company?.stripeCustomerId) {
      throw new HttpError(409, "NO_BILLING_ACCOUNT", "This company does not have a Stripe billing account yet.");
    }
    const session = await stripe.billingPortal.sessions.create({ customer: company.stripeCustomerId, return_url: returnUrl });

    return NextResponse.json({ url: session.url, portalUrl: session.url, demo: false }, { headers: privateNoStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}
