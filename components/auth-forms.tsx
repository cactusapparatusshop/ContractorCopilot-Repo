"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";

type FormMode = "sign-in" | "sign-up";
type AuthResult = { phoneVerificationRequired?: boolean; mfaRequired?: boolean; mfaMethod?: "phone" | "totp"; email?: string };
type AuthFormProps = { mode: FormMode };

export function AuthForm({ mode }: AuthFormProps) {
  const isSignUp = mode === "sign-up";
  const [loading, setLoading] = useState<"submit" | "demo" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function request(path: string, body?: Record<string, string>) {
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "We couldn't complete that request.");
    return data as AuthResult;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setLoading("submit");
    setMessage(null);
    try {
      const result = isSignUp
        ? await request("/api/auth/sign-up", {
            name: String(form.get("name") ?? ""),
            companyName: String(form.get("companyName") ?? ""),
            email,
            phone: String(form.get("phone") ?? ""),
            password,
          })
        : await request("/api/auth/sign-in", { email, password });

      if (result.phoneVerificationRequired) {
        window.location.assign("/verify-phone");
      } else if (result.mfaRequired) {
        window.location.assign(result.mfaMethod === "phone" ? "/verify-phone" : "/two-factor");
      } else {
        window.location.assign("/dashboard");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't complete that request.");
    } finally {
      setLoading(null);
    }
  }

  async function startDemo() {
    setLoading("demo");
    setMessage(null);
    try {
      await request("/api/auth/demo");
      window.location.assign("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demo mode is unavailable.");
    } finally {
      setLoading(null);
    }
  }

  return <form onSubmit={submit}>
    {isSignUp && <><div className="field"><label>Your name</label><input name="name" autoComplete="name" placeholder="Jordan Taylor" required /></div><div className="field" style={{ marginTop: 13 }}><label>Company name</label><input name="companyName" autoComplete="organization" placeholder="Your Company LLC" required /></div></>}
    <div className="field" style={isSignUp ? { marginTop: 13 } : undefined}><label>Email address</label><input name="email" type="email" autoComplete="email" placeholder="you@company.com" required /></div>
    {isSignUp && <div className="field" style={{ marginTop: 13 }}><label>Mobile number</label><input name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+1 512 555 0194" required /><small style={{ display: "block", marginTop: 5, color: "var(--ink-faint)", fontSize: 10 }}>We’ll text this number to confirm your account and protect future sign-ins.</small></div>}
    <div className="field" style={{ marginTop: 13 }}><label>Password</label><input name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} placeholder={isSignUp ? "At least 12 characters" : "Your password"} minLength={isSignUp ? 12 : undefined} required /></div>
    {!isSignUp && <div style={{ display: "flex", justifyContent: "flex-end", margin: "11px 0 20px", color: "var(--ink-soft)", fontSize: 11 }}><Link href="/forgot-password" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>Forgot password?</Link></div>}
    {isSignUp && <p style={{ margin: "10px 0 20px", color: "var(--ink-faint)", fontSize: 10, lineHeight: 1.45 }}>Start with three free proposal creations. We’ll text a verification code to activate your workspace.</p>}
    <button className="button button-primary" style={{ width: "100%" }} disabled={loading !== null}>{loading === "submit" ? <><LoaderCircle className="spinner" /> {isSignUp ? "Creating account…" : "Signing in…"}</> : <>{isSignUp ? "Create free account" : "Sign in"} <ArrowRight size={16} /></>}</button>
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0", color: "var(--ink-faint)", fontSize: 10 }}><span style={{ height: 1, flex: 1, background: "var(--line)" }} />OR<span style={{ height: 1, flex: 1, background: "var(--line)" }} /></div>
    <button type="button" className="button button-outline" style={{ width: "100%" }} onClick={startDemo} disabled={loading !== null}>{loading === "demo" ? <><LoaderCircle className="spinner" /> Opening preview…</> : "Explore the live demo"}</button>
    {message && <p role="alert" style={{ margin: "13px 0 0", padding: "9px 10px", borderRadius: 7, background: "var(--red-soft)", color: "var(--red)", fontSize: 11 }}>{message}</p>}
    <p style={{ marginTop: 18, color: "var(--ink-faint)", fontSize: 11, textAlign: "center" }}>{isSignUp ? <>Already have an account? <Link href="/sign-in" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>Sign in</Link></> : <>New here? <Link href="/sign-up" style={{ color: "var(--orange-dark)", fontWeight: 700 }}>Create your free account</Link></>}</p>
  </form>;
}
