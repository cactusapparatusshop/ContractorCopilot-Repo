import "server-only";

import { HttpError } from "@/lib/http";

const twilioApi = "https://verify.twilio.com/v2/Services";

function config() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!accountSid || !authToken || !serviceSid) {
    throw new HttpError(503, "PHONE_UNAVAILABLE", "Phone verification is not configured yet. Please try again shortly.");
  }
  return { accountSid, authToken, serviceSid };
}

export function normalizePhone(value: string) {
  const compact = value.replace(/[\s().-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(compact)) {
    throw new HttpError(400, "INVALID_PHONE", "Enter a mobile number with country code, for example +15125550194.");
  }
  return compact;
}

async function twilioRequest(path: string, body: URLSearchParams) {
  const { accountSid, authToken, serviceSid } = config();
  const response = await fetch(`${twilioApi}/${encodeURIComponent(serviceSid)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null) as { message?: string; status?: string } | null;
  if (!response.ok) {
    console.error("Twilio Verify request failed", response.status, data?.message);
    throw new HttpError(502, "PHONE_DELIVERY_FAILED", "We couldn't send a phone verification code. Please try again shortly.");
  }
  return data;
}

export async function sendPhoneVerification(phone: string) {
  await twilioRequest("/Verifications", new URLSearchParams({ To: phone, Channel: "sms" }));
}

export async function verifyPhoneCode(phone: string, code: string) {
  const data = await twilioRequest("/VerificationCheck", new URLSearchParams({ To: phone, Code: code }));
  return data?.status === "approved";
}
