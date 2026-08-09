import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getBillingState } from "@/lib/entitlements";
import { errorResponse, privateNoStoreHeaders } from "@/lib/http";
import { PRO_MONTHLY_PRICE_CENTS, PRO_TRIAL_DAYS } from "@/lib/stripe";

export const runtime = "nodejs";

/** A small, UI-safe source of truth for the free allowance and Pro price. */
export async function GET() {
  try {
    const user = await requireUser();
    const billing = await getBillingState(user);
    return NextResponse.json(
      {
        ...billing,
        proMonthlyPriceCents: PRO_MONTHLY_PRICE_CENTS,
        proMonthlyCurrency: "usd",
        proTrialDays: PRO_TRIAL_DAYS,
      },
      { headers: privateNoStoreHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
