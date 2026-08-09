"use client";

import { CheckCircle2, CreditCard, ExternalLink, FileText, LoaderCircle, Settings2, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/app-shell";

type Usage = {
  plan: "demo" | "free" | "pro";
  freeDocumentCreationLimit: number;
  freeDocumentCreationsUsed: number;
  freeDocumentCreationsRemaining: number | null;
  proMonthlyPriceCents?: number;
  proMonthlyCurrency?: string;
  proTrialDays?: number;
};

const freeUsage: Usage = { plan: "free", freeDocumentCreationLimit: 3, freeDocumentCreationsUsed: 0, freeDocumentCreationsRemaining: 3, proMonthlyPriceCents: 4999, proMonthlyCurrency: "usd", proTrialDays: 14 };

export default function BillingPage() {
  const [pending, setPending] = useState<"upgrade" | "portal" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage>(freeUsage);
  const [showTrialDisclosure, setShowTrialDisclosure] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/billing/usage").then((response) => response.ok ? response.json() : null).then((data: Usage | null) => { if (active && data) setUsage(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function start(action: "upgrade" | "portal") {
    setPending(action);
    setNotice(null);
    try {
      const response = await fetch(action === "upgrade" ? "/api/billing/checkout" : "/api/billing/portal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: "pro" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Billing is not available yet.");
      if (data.url) window.location.assign(data.url);
      else throw new Error("Stripe did not return a secure checkout link.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Billing is not available yet.");
    } finally {
      setPending(null);
    }
  }

  const isPro = usage.plan === "pro";
  const limit = usage.freeDocumentCreationLimit || 3;
  const used = Math.min(usage.freeDocumentCreationsUsed, limit);
  const remaining = usage.freeDocumentCreationsRemaining ?? Math.max(limit - used, 0);
  const percent = isPro ? 100 : Math.max((used / limit) * 100, 5);
  const proPrice = new Intl.NumberFormat("en-US", { style: "currency", currency: usage.proMonthlyCurrency ?? "usd" }).format((usage.proMonthlyPriceCents ?? 4999) / 100);
  const trialDays = usage.proTrialDays ?? 14;
  const firstChargeDate = useMemo(() => { const date = new Date(); date.setDate(date.getDate() + trialDays); return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }, [trialDays]);

  return <>
    <PageHeader title="Plans & usage" subtitle="Three free proposal creations, then one simple Pro plan."><button className="button button-outline" onClick={() => isPro ? start("portal") : setNotice("Payment details become available after you upgrade to Pro.")}><Settings2 size={14} /> Payment settings</button></PageHeader>
    <section className="billing-grid modern-billing-grid">
      <article className={`card plan-card usage-plan-card ${isPro ? "usage-plan-pro" : ""}`}>
        <div className="eyebrow">Your workspace</div><h2>{isPro ? "Pro plan" : "Free plan"}</h2><p>{isPro ? "Your team can create proposals without a document limit." : "Create three polished proposals free before deciding to upgrade."}</p>
        <div className="usage-document-count"><span><FileText size={17} /></span><div><b>{isPro ? "Unlimited" : `${remaining} of ${limit} remaining`}</b><small>{isPro ? "Proposal creations" : "Free proposal creations"}</small></div></div>
        <div className="plan-usage"><div className="plan-usage-top"><span>{isPro ? "Pro document access" : "Free proposal usage"}</span><span>{isPro ? "Unlimited" : `${used} / ${limit} used`}</span></div><div className="progress"><i style={{ width: `${percent}%` }} /></div></div>
        <div className="plan-facts"><div><small>{isPro ? "Monthly price" : "After your Pro trial"}</small><b>{proPrice} / month</b></div><div><small>{isPro ? "Status" : "Payment"}</small><b>{isPro ? "Active" : "No card for free plan"}</b></div></div>
        <button className="button" onClick={() => isPro ? start("portal") : setShowTrialDisclosure(true)} disabled={pending !== null} style={{ width: "100%", background: "white", color: "var(--navy)" }}>{pending ? <><LoaderCircle className="spinner" /> Opening…</> : isPro ? <><ExternalLink size={14} /> Manage subscription</> : <><Sparkles size={14} /> Start Pro trial</>}</button>
      </article>
      <aside className="card upgrade-card"><div className="upgrade-card-top"><div className="icon-box purple"><Sparkles /></div><span>ONE SIMPLE PLAN</span></div><h2>Keep the paperwork moving.</h2><p>After a {trialDays}-day Pro trial, Pro is {proPrice} per month. It removes the proposal limit and keeps every quote, approval, and deposit in one polished workspace.</p><div className="upgrade-price"><strong>{proPrice}</strong><span>per month</span></div><ul className="upgrade-list"><li><CheckCircle2 size={15} /> {trialDays}-day Pro trial before your first charge</li><li><CheckCircle2 size={15} /> Unlimited proposals and PDFs</li><li><CheckCircle2 size={15} /> Online approvals and deposit payments</li><li><CheckCircle2 size={15} /> AI estimating, CRM, and price book</li></ul>{!isPro && <button className="button button-primary" style={{ width: "100%", marginTop: 18 }} onClick={() => setShowTrialDisclosure(true)} disabled={pending !== null}>Start {trialDays}-day Pro trial <Sparkles size={14} /></button>}</aside>
    </section>
    <section className="card billing-history-card"><div className="card-heading"><div><h2>Billing history</h2><p>{isPro ? "Your ContractorCopilot subscription receipts." : "Your three free proposals never require a card."}</p></div>{isPro && <button className="button button-outline button-sm" onClick={() => start("portal")}><CreditCard size={13} /> Update card</button>}</div>{isPro ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Date</th><th>Description</th><th>Status</th><th>Amount</th></tr></thead><tbody><tr><td className="strong">Latest receipt</td><td>Available in Stripe</td><td>ContractorCopilot Pro · Monthly</td><td><span className="status paid">Paid</span></td><td className="strong">{proPrice}</td></tr></tbody></table></div> : <div className="billing-empty"><span><CreditCard size={18} /></span><div><b>No subscription invoices yet</b><p>You’ll only be charged if you choose to continue after the Pro trial.</p></div></div>}</section>
    {showTrialDisclosure && <div className="billing-modal-backdrop" role="presentation"><section className="billing-modal" role="dialog" aria-modal="true" aria-labelledby="trial-title"><button className="icon-button" aria-label="Close trial information" onClick={() => setShowTrialDisclosure(false)} style={{ position: "absolute", right: 15, top: 15 }}><X size={16} /></button><div className="icon-box purple"><Sparkles /></div><h2 id="trial-title">Start your {trialDays}-day Pro trial</h2><p>No charge today. A payment method is required to start the trial. Unless you cancel before <b>{firstChargeDate}</b>, ContractorCopilot Pro will automatically continue at <b>{proPrice} per month</b>.</p><ul><li>Cancel anytime in the Stripe billing portal before the trial ends.</li><li>Your three free proposals remain available if you choose not to continue.</li><li>After the trial, Pro includes unlimited proposal creations and PDFs.</li></ul><div style={{ display: "flex", gap: 9, marginTop: 20, justifyContent: "flex-end" }}><button className="button button-outline" onClick={() => setShowTrialDisclosure(false)} disabled={pending === "upgrade"}>Not now</button><button className="button button-primary" onClick={() => { setShowTrialDisclosure(false); void start("upgrade"); }} disabled={pending === "upgrade"}>{pending === "upgrade" ? <><LoaderCircle className="spinner" /> Opening checkout…</> : "Continue to secure checkout"}</button></div></section></div>}
    {notice && <div className="toast"><CheckCircle2 />{notice}</div>}
  </>;
}
