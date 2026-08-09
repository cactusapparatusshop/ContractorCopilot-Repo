"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText } from "lucide-react";
import { useEffect, useState } from "react";

type Usage = {
  plan: "demo" | "free" | "pro";
  freeDocumentCreationLimit: number;
  freeDocumentCreationsUsed: number;
  freeDocumentCreationsRemaining: number | null;
};

const defaultUsage: Usage = {
  plan: "free",
  freeDocumentCreationLimit: 3,
  freeDocumentCreationsUsed: 0,
  freeDocumentCreationsRemaining: 3,
};

export function DocumentUsageBanner() {
  const [usage, setUsage] = useState<Usage>(defaultUsage);

  useEffect(() => {
    let active = true;
    fetch("/api/billing/usage")
      .then((response) => response.ok ? response.json() : null)
      .then((data: Usage | null) => { if (active && data) setUsage(data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  if (usage.plan === "pro") {
    return <section className="usage-banner usage-banner-pro"><span className="usage-banner-icon"><CheckCircle2 size={18} /></span><div><b>ContractorCopilot Pro is active</b><p>Unlimited proposal creations and PDFs are ready whenever your next job is.</p></div><Link href="/billing" className="text-link">Manage plan <ArrowRight size={14} /></Link></section>;
  }

  const used = Math.min(usage.freeDocumentCreationsUsed, usage.freeDocumentCreationLimit);
  const remaining = usage.freeDocumentCreationsRemaining ?? Math.max(usage.freeDocumentCreationLimit - used, 0);
  const exhausted = remaining === 0;

  return <section className={`usage-banner ${exhausted ? "usage-banner-limit" : ""}`}>
    <span className="usage-banner-icon"><FileText size={18} /></span>
    <div className="usage-banner-copy"><b>{exhausted ? "Your 3 free proposals are used" : `${remaining} of 3 free proposals still available`}</b><p>{exhausted ? "Upgrade to keep creating proposals without interruption." : "A proposal uses one credit the first time its PDF is created; later downloads of the same proposal are free."}</p><div className="usage-meter" aria-label={`${used} of ${usage.freeDocumentCreationLimit} free proposals used`}><i style={{ width: `${Math.max((used / usage.freeDocumentCreationLimit) * 100, 5)}%` }} /></div></div>
    <Link href="/billing" className={exhausted ? "button button-primary button-sm" : "text-link"}>{exhausted ? "Upgrade to Pro" : "See plans"} <ArrowRight size={14} /></Link>
  </section>;
}
