import { POST as createDepositCheckout } from "@/app/api/payments/deposit-checkout/route";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";

/** Customer-portal shorthand for the public deposit checkout endpoint. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const forwarded = new Request(request.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(request.headers.get("origin") ? { origin: request.headers.get("origin")! } : {}),
      },
      body: JSON.stringify({ proposalToken: token }),
    });
    return createDepositCheckout(forwarded);
  } catch (error) {
    return errorResponse(error);
  }
}
