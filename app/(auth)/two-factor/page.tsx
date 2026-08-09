import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { TwoFactorSignInForm } from "@/components/account-security-forms";

export default function TwoFactorPage() {
  return <main className="auth-security-shell"><section className="auth-security-card"><Link className="brand" href="/"><span className="brand-mark">C</span>ContractorCopilot</Link><div className="icon-box purple" style={{ marginTop: 34 }}><ShieldCheck /></div><div className="eyebrow" style={{ marginTop: 16 }}>Two-factor authentication</div><h1>Verify it’s you</h1><p>Enter the code from your authenticator app to finish signing in.</p><TwoFactorSignInForm /></section></main>;
}
