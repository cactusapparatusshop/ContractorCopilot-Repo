import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { PhoneVerificationForm } from "@/components/account-security-forms";

export default function VerifyPhonePage() {
  return <main className="auth-security-shell"><section className="auth-security-card"><Link className="brand" href="/"><span className="brand-mark">C</span>ContractorCopilot</Link><div className="icon-box purple" style={{ marginTop: 34 }}><MessageSquareText /></div><div className="eyebrow" style={{ marginTop: 16 }}>Phone verification</div><h1>Check your messages</h1><p>Enter the code we texted you to activate your workspace or finish signing in.</p><PhoneVerificationForm /></section></main>;
}
