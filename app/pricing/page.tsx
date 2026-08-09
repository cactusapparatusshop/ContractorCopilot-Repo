import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";

const plans = [
  {
    name: "Free", price: "$0", detail: "A no-pressure way to send your first polished documents.",
    features: ["3 proposal or invoice creations", "AI-assisted scope and estimate builder", "Branded PDF documents", "Customer approval portal"], action: "Start free", href: "/sign-up",
  },
  {
    name: "ContractorCopilot Pro", price: "$49.99", detail: "One simple plan for contractors ready to quote and collect without limits.",
    features: ["14-day Pro trial before the first $49.99 charge", "Unlimited proposal and invoice creations", "AI-assisted estimating", "Online approval and deposit collection", "Price book, CRM, and team workspace"], action: "Upgrade to Pro", href: "/billing", featured: true,
  },
];

export default function PricingPage() {
  return <main style={{ minHeight: "100vh", padding: "28px 24px", background: "var(--canvas)" }}>
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      <Link href="/" className="button button-ghost button-sm"><ChevronLeft size={15} /> Back to home</Link>
      <div className="pricing-hero">
        <div className="eyebrow">Simple, contractor-friendly pricing</div>
        <h1>Start free. Upgrade when the work starts flowing.</h1>
        <p>Make three proposals free. When you&apos;re ready, start a 14-day Pro trial, then continue for $49.99 per month unless you cancel.</p>
      </div>
      <div className="pricing-grid pricing-grid-simple">
        {plans.map((plan) => <section key={plan.name} className={`card pricing-plan ${plan.featured ? "pricing-plan-featured" : ""}`}>
          {plan.featured && <span className="pricing-popular">BEST VALUE</span>}
          <h2 style={{ margin: 0, fontSize: 17 }}>{plan.name}</h2><p style={{ minHeight: 41, color: "var(--ink-soft)", fontSize: 12 }}>{plan.detail}</p>
          <div className="pricing-price"><strong>{plan.price}</strong><span>{plan.name === "Free" ? "No card required" : " / month"}</span></div>
          <Link className={`button ${plan.featured ? "button-primary" : "button-outline"}`} href={plan.href} style={{ width: "100%" }}>{plan.action}</Link>
          <div style={{ marginTop: 21, display: "grid", gap: 11 }}>{plan.features.map((feature) => <span key={feature} style={{ display: "flex", gap: 8, color: "var(--ink-soft)", fontSize: 12 }}><Check size={15} color="var(--teal)" /> {feature}</span>)}</div>
        </section>)}</div>
    </div>
  </main>;
}
