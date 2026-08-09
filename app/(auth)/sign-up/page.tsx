import Link from "next/link";
import { CheckCircle2, FileText, LockKeyhole } from "lucide-react";

import { AuthForm } from "@/components/auth-forms";

export default function SignUpPage() {
  return (
    <main className="signin-shell" style={{ minHeight: "100vh", display: "grid", gridTemplateColumns: "minmax(380px, .9fr) minmax(0, 1.1fr)", background: "white" }}>
      <section style={{ padding: "34px clamp(28px, 7vw, 94px)", display: "flex", flexDirection: "column" }}>
        <Link className="brand" href="/"><span className="brand-mark">C</span>ContractorCopilot</Link>
        <div style={{ maxWidth: 390, width: "100%", margin: "auto" }}>
          <div className="eyebrow">Start free</div>
          <h1 style={{ margin: "10px 0 8px", fontSize: 34, letterSpacing: "-.06em" }}>Build your first better estimate</h1>
          <p style={{ margin: "0 0 25px", color: "var(--ink-soft)" }}>Set up your company workspace in less than two minutes.</p>
          <AuthForm mode="sign-up" />
          <p style={{ marginTop: 22, color: "var(--ink-faint)", fontSize: 10, textAlign: "center" }}><LockKeyhole size={11} style={{ verticalAlign: "-2px" }} /> No credit card required to get started.</p>
        </div>
        <p style={{ color: "var(--ink-faint)", fontSize: 10 }}>© 2026 ContractorCopilot, Inc.</p>
      </section>
      <aside className="signin-aside" style={{ padding: 44, display: "flex", alignItems: "center", background: "var(--navy)", color: "white" }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 99, background: "rgba(244,110,40,.16)", color: "#ffc193", fontSize: 10, fontWeight: 800, letterSpacing: ".08em" }}><FileText size={12} /> 3 FREE PROPOSALS</span>
          <h2 style={{ margin: "17px 0", fontSize: 45, lineHeight: 1.02, letterSpacing: "-.065em" }}>Make your next quote your easiest one.</h2>
          <p style={{ maxWidth: 410, color: "#b6c7ca", fontSize: 15, lineHeight: 1.65 }}>Start with three free proposal creations. Upgrade only when you need unlimited proposals, payments, and automation.</p>
          <div style={{ display: "grid", gap: 13, marginTop: 34 }}>
            {["No credit card needed for your three free proposals", "Your pricing and customer data stay private", "A 14-day Pro trial is explained before you subscribe"].map((line) => (
              <span key={line} style={{ display: "flex", gap: 9, color: "#e0ecec", fontSize: 12 }}><CheckCircle2 size={16} color="#7de0cb" />{line}</span>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
