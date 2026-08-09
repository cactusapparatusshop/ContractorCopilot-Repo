import { NextResponse } from "next/server";

import { isAiConfigured } from "@/lib/ai";
import { isDemoMode } from "@/lib/auth";
import { checkDatabaseHealth } from "@/lib/db";
import { isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabaseHealth();
  const degraded = database === "unavailable";

  return NextResponse.json(
    {
      service: "contractorcopilot-api",
      status: degraded ? "degraded" : "ok",
      timestamp: new Date().toISOString(),
      mode: isDemoMode() ? "demo" : "live",
      services: {
        database,
        ai: isAiConfigured() ? "configured" : "demo",
        stripe: isStripeConfigured() ? "configured" : "demo",
      },
    },
    { status: degraded ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
