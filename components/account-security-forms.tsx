"use client";

import Link from "next/link";
import { CheckCircle2, CopyCheck, KeyRound, LoaderCircle, ShieldCheck, Smartphone } from "lucide-react";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

async function post(path: string, body: Record<string, string>) {
  const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "We couldn't complete that request.");
  return data as Record<string, unknown>;
}

function Notice({ message, error = false }: { message: string | null; error?: boolean }) {
  if (!message) return null;
  return <p role="alert" style={{ margin: "13px 0 0", padding: "10px 11px", borderRadius: 8, background: error ? "var(--red-soft)" : "var(--blue-soft)", color: error ? "var(--red)" : "var(--blue)", fontSize: 11, lineHeight: 1.5 }}>{message}</p>;
}

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setLoading(true); setMessage(null); setError(false);
    try {
      const result = await post("/api/auth/password-reset/request", { email });
      setMessage(String(result.message ?? "If that email belongs to an account, we've sent a reset link."));
    } catch (caught) {
      setError(true); setMessage(caught instanceof Error ? caught.message : "We couldn't send a reset link.");
    } finally { setLoading(false); }
  }
  return <form onSubmit={submit}><div className="field"><label>Email address</label><input name="email" type="email" autoComplete="email" placeholder="you@company.com" required /></div><button className="button button-primary" style={{ marginTop: 16, width: "100%" }} disabled={loading}>{loading ? <><LoaderCircle className="spinner" /> Sending…</> : "Send reset link"}</button><Notice message={message} error={error} /><p style={{ marginTop: 18, textAlign: "center", fontSize: 11 }}><Link href="/sign-in" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>Back to sign in</Link></p></form>;
}

export function VerifyEmailForm() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(token ? null : "This verification link is missing or incomplete.");
  const [error, setError] = useState(!token);
  async function verify() {
    if (!token) return;
    setLoading(true); setMessage(null); setError(false);
    try {
      await post("/api/auth/email-verification/confirm", { token });
      setMessage("Email verified. You can now sign in to your ContractorCopilot workspace.");
    } catch (caught) {
      setError(true); setMessage(caught instanceof Error ? caught.message : "We couldn't verify that email.");
    } finally { setLoading(false); }
  }
  return <div><p style={{ color: "var(--ink-soft)", lineHeight: 1.6 }}>Confirm this one-time link to activate your new workspace. It expires after 24 hours.</p><button className="button button-primary" style={{ marginTop: 12, width: "100%" }} onClick={verify} disabled={loading || !token}>{loading ? <><LoaderCircle className="spinner" /> Verifying…</> : "Verify email"}</button><Notice message={message} error={error} />{message && !error && <p style={{ marginTop: 18, textAlign: "center", fontSize: 11 }}><Link href="/sign-in" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>Continue to sign in</Link></p>}</div>;
}

export function ResetPasswordForm() {
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(token ? null : "This password-reset link is missing or incomplete.");
  const [error, setError] = useState(!token);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (password !== confirmPassword) { setError(true); setMessage("The passwords do not match."); return; }
    setLoading(true); setMessage(null); setError(false);
    try {
      await post("/api/auth/password-reset/confirm", { token, password });
      setMessage("Your password has been reset. Sign in with the new password to continue.");
    } catch (caught) {
      setError(true); setMessage(caught instanceof Error ? caught.message : "We couldn't reset your password.");
    } finally { setLoading(false); }
  }
  return <form onSubmit={submit}><div className="field"><label>New password</label><input name="password" type="password" autoComplete="new-password" minLength={12} placeholder="At least 12 characters" required disabled={!token} /></div><div className="field" style={{ marginTop: 13 }}><label>Confirm new password</label><input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} placeholder="Repeat your new password" required disabled={!token} /></div><button className="button button-primary" style={{ marginTop: 16, width: "100%" }} disabled={loading || !token}>{loading ? <><LoaderCircle className="spinner" /> Resetting…</> : "Reset password"}</button><Notice message={message} error={error} />{message && !error && <p style={{ marginTop: 18, textAlign: "center", fontSize: 11 }}><Link href="/sign-in" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>Sign in</Link></p>}</form>;
}

export function TwoFactorSignInForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    setLoading(true); setMessage(null);
    try {
      await post("/api/auth/two-factor/verify", { code });
      window.location.assign("/dashboard");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "We couldn't verify that code.");
    } finally { setLoading(false); }
  }
  return <form onSubmit={submit}><div className="field"><label>Authenticator or recovery code</label><input name="code" autoComplete="one-time-code" inputMode="numeric" placeholder="123456 or ABCD-EFGH-IJKL" required autoFocus /></div><button className="button button-primary" style={{ marginTop: 16, width: "100%" }} disabled={loading}>{loading ? <><LoaderCircle className="spinner" /> Verifying…</> : "Verify and continue"}</button><Notice message={message} error /><p style={{ marginTop: 18, fontSize: 10, color: "var(--ink-faint)", textAlign: "center" }}>Use a six-digit code from your authenticator, or one unused recovery code.</p></form>;
}

type SetupInfo = { manualKey: string; otpAuthUrl: string; expiresInSeconds: number };

export function TwoFactorSettings({ initialEnabled, available, preview }: { initialEnabled: boolean; available: boolean; preview?: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState<"setup" | "confirm" | "disable" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState(false);

  function resetNotice() { setMessage(null); setError(false); }
  async function beginSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetNotice(); setLoading("setup");
    try {
      const result = await post("/api/auth/two-factor/setup", { currentPassword: String(new FormData(event.currentTarget).get("currentPassword") ?? "") });
      setSetup({ manualKey: String(result.manualKey), otpAuthUrl: String(result.otpAuthUrl), expiresInSeconds: Number(result.expiresInSeconds) });
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : "We couldn't start two-factor setup."); } finally { setLoading(null); }
  }
  async function confirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetNotice(); setLoading("confirm");
    try {
      const result = await post("/api/auth/two-factor/confirm-setup", { code: String(new FormData(event.currentTarget).get("code") ?? "") });
      setRecoveryCodes(Array.isArray(result.recoveryCodes) ? result.recoveryCodes.map(String) : []);
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : "We couldn't confirm two-factor setup."); } finally { setLoading(null); }
  }
  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); resetNotice(); setLoading("disable");
    const form = new FormData(event.currentTarget);
    try {
      await post("/api/auth/two-factor/disable", { currentPassword: String(form.get("currentPassword") ?? ""), code: String(form.get("code") ?? "") });
      setEnabled(false); setSetup(null); setRecoveryCodes(null); setMessage("Two-factor authentication has been turned off for this account.");
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : "We couldn't turn off two-factor authentication."); } finally { setLoading(null); }
  }

  return <article className="card side-card">
    <div className="icon-box purple"><ShieldCheck /></div><h2 style={{ marginTop: 12 }}>Account security</h2>
    {preview ? <p>Authenticator-app security is available after you create your own workspace.</p> : !available ? <p>Authenticator setup will be available once the server security key is configured.</p> : recoveryCodes ? <><p><b>Save these recovery codes now.</b> Each code works once if you lose your authenticator. They will not be shown again.</p><pre style={{ margin: "14px 0", whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.8, letterSpacing: ".06em", padding: 12, borderRadius: 8, background: "var(--surface-soft)" }}>{recoveryCodes.join("\n")}</pre><button type="button" className="button button-primary button-sm" style={{ width: "100%" }} onClick={() => { setRecoveryCodes(null); setSetup(null); setEnabled(true); setMessage("Two-factor authentication is now on."); }}><CopyCheck size={14} /> I saved my recovery codes</button></> : setup ? <><p>Add this account in Google Authenticator, Microsoft Authenticator, Authy, 1Password, or any TOTP-compatible app. Use the setup key if your app does not open the link.</p><a className="button button-outline button-sm" style={{ width: "100%", marginTop: 10 }} href={setup.otpAuthUrl}>Open authenticator app</a><div className="field" style={{ marginTop: 12 }}><label>Manual setup key</label><input value={setup.manualKey} readOnly style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", letterSpacing: ".08em" }} /></div><form onSubmit={confirmSetup} style={{ marginTop: 12 }}><div className="field"><label>Enter the 6-digit code</label><input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required /></div><button className="button button-primary button-sm" style={{ width: "100%", marginTop: 10 }} disabled={loading !== null}>{loading === "confirm" ? <><LoaderCircle className="spinner" /> Confirming…</> : <><Smartphone size={14} /> Confirm authenticator</>}</button></form></> : enabled ? <><p>Your account requires an authenticator code after your password. You can turn it off only by confirming your password and a current code.</p><form onSubmit={disable} style={{ display: "grid", gap: 10, marginTop: 12 }}><div className="field"><label>Current password</label><input name="currentPassword" type="password" autoComplete="current-password" required /></div><div className="field"><label>Authenticator or recovery code</label><input name="code" autoComplete="one-time-code" placeholder="123456 or recovery code" required /></div><button className="button button-outline button-sm" style={{ width: "100%" }} disabled={loading !== null}>{loading === "disable" ? <><LoaderCircle className="spinner" /> Turning off…</> : "Turn off two-factor authentication"}</button></form></> : <><p>Add a second step at sign-in with Google Authenticator or another standard authenticator app.</p><form onSubmit={beginSetup} style={{ marginTop: 12 }}><div className="field"><label>Current password</label><input name="currentPassword" type="password" autoComplete="current-password" required /></div><button className="button button-primary button-sm" style={{ width: "100%", marginTop: 10 }} disabled={loading !== null}>{loading === "setup" ? <><LoaderCircle className="spinner" /> Preparing…</> : <><KeyRound size={14} /> Set up authenticator app</>}</button></form></>}
    <Notice message={message} error={error} />
  </article>;
}
