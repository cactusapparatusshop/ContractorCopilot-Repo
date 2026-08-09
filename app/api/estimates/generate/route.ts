import { NextResponse } from "next/server";

import { POST as generateEstimate } from "@/app/api/ai/estimate/route";
import { errorResponse, readJson, requireObject, stringField } from "@/lib/http";

export const runtime = "nodejs";

type LegacyGenerateRequest = { jobType?: unknown; notes?: unknown; measurements?: unknown };

/** Compatibility endpoint used by the preview wizard; new integrations should use /api/ai/estimate. */
export async function POST(request: Request) {
  try {
    const body = await readJson<LegacyGenerateRequest>(request);
    const measurements = Array.isArray(body.measurements)
      ? body.measurements.map((entry, index) => {
          const item = requireObject(entry, `measurements[${index}] must be an object.`);
          const label = stringField(item.label, `measurements[${index}].label`, { max: 80 })!;
          const quantity = stringField(item.quantity, `measurements[${index}].quantity`, { max: 40 })!;
          const unit = stringField(item.unit, `measurements[${index}].unit`, { max: 20 })!;
          return `${label}: ${quantity} ${unit}`;
        }).join("\n")
      : undefined;
    const mappedBody = {
      title: stringField(body.jobType, "jobType", { max: 160 }),
      jobDescription: stringField(body.notes, "notes", { max: 6_000 }),
      measurements,
    };
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(request.headers.get("origin") ? { origin: request.headers.get("origin")! } : {}),
      },
      body: JSON.stringify(mappedBody),
    });
    const response = await generateEstimate(forwarded);
    if (!response.ok) return response;
    const result = await response.json();
    const lineItems = Array.isArray(result.pricing?.lineItems)
      ? result.pricing.lineItems.map((item: { description: string; category: string; quantity: number; unit: string; lineTotalCents: number }) => ({
          description: item.description,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          amount: item.lineTotalCents / 100,
        }))
      : [];
    return NextResponse.json({ ...result, lineItems });
  } catch (error) {
    return errorResponse(error);
  }
}
