import Link from "next/link";
import { KeyRound } from "lucide-react";
import { ForgotPasswordForm } from "@/components/account-security-forms";

export default function ForgotPasswordPage() {
  return <main className="auth-security-shell"><section className="auth-security-card"><Link className="brand" href="/"><span className="brand-mark">C</span>ContractorCopilot</Link><div className="icon-box purple" style={{ marginTop: 34 }}><KeyRound /></div><div className="eyebrow" style={{ marginTop: 16 }}>Account recovery</div><h1>Reset your password</h1><p>Enter your account email and we will send a one-time password reset link.</p><ForgotPasswordForm /></section></main>;
}
