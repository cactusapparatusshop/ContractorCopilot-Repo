import "server-only";

import { Resend } from "resend";

import { appUrl } from "@/lib/http";

declare global {
  // eslint-disable-next-line no-var
  var contractorCopilotResend: Resend | undefined;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim());
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  if (!globalThis.contractorCopilotResend) globalThis.contractorCopilotResend = new Resend(apiKey);
  return globalThis.contractorCopilotResend;
}

async function send({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const resend = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!resend || !from) throw new Error("Account email delivery is not configured.");
  const result = await resend.emails.send({ from, to, subject, html, text });
  if (result.error) throw new Error("We couldn't deliver that account email. Please try again shortly.");
}

function accountEmailShell(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7f8;font-family:Arial,sans-serif;color:#13242c"><main style="max-width:560px;margin:32px auto;padding:36px;background:#fff;border-radius:14px"><div style="font-weight:800;color:#0f766e;font-size:20px">ContractorCopilot</div><h1 style="font-size:24px;margin:24px 0 12px">${title}</h1>${body}<p style="margin-top:28px;color:#60727b;font-size:13px">If you did not request this, you can safely ignore this email.</p></main></body></html>`;
}

export async function sendVerificationEmail({ email, token }: { email: string; token: string }) {
  const url = new URL("/verify-email", appUrl());
  url.searchParams.set("token", token);
  await send({
    to: email,
    subject: "Verify your ContractorCopilot email",
    html: accountEmailShell("Verify your email", `<p>Thanks for creating your ContractorCopilot workspace. Confirm your email to finish setting up your account.</p><p style="margin:24px 0"><a href="${url.toString()}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700">Verify email</a></p><p style="font-size:13px;color:#60727b">This link expires in 24 hours.</p>`),
    text: `Verify your ContractorCopilot email: ${url.toString()}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPasswordResetEmail({ email, token }: { email: string; token: string }) {
  const url = new URL("/reset-password", appUrl());
  url.searchParams.set("token", token);
  await send({
    to: email,
    subject: "Reset your ContractorCopilot password",
    html: accountEmailShell("Reset your password", `<p>Use the secure link below to choose a new ContractorCopilot password.</p><p style="margin:24px 0"><a href="${url.toString()}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700">Reset password</a></p><p style="font-size:13px;color:#60727b">This link expires in 30 minutes and can be used once.</p>`),
    text: `Reset your ContractorCopilot password: ${url.toString()}\n\nThis link expires in 30 minutes and can be used once.`,
  });
}
