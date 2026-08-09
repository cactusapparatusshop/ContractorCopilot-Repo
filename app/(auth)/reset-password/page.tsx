import { Suspense } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { ResetPasswordForm } from "@/components/account-security-forms";

export default function ResetPasswordPage() {
  return <main className="auth-security-shell"><section className="auth-security-card"><Link className="brand" href="/"><span className="brand-mark">C</span>ContractorCopilot</Link><div className="icon-box purple" style={{ marginTop: 34 }}><LockKeyhole /></div><div className="eyebrow" style={{ marginTop: 16 }}>Secure recovery</div><h1>Choose a new password</h1><p>Use at least 12 characters. This link can be used only once.</p><Suspense fallback={<p>Loading password reset…</p>}><ResetPasswordForm /></Suspense></section></main>;
}
