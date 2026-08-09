import { Suspense } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { VerifyEmailForm } from "@/components/account-security-forms";

export default function VerifyEmailPage() {
  return <main className="auth-security-shell"><section className="auth-security-card"><Link className="brand" href="/"><span className="brand-mark">C</span>ContractorCopilot</Link><div className="icon-box teal" style={{ marginTop: 34 }}><MailCheck /></div><div className="eyebrow" style={{ marginTop: 16 }}>One last step</div><h1>Verify your email</h1><Suspense fallback={<p>Loading verification link…</p>}><VerifyEmailForm /></Suspense></section></main>;
}
