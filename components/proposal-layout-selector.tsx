"use client";

import { CheckCircle2, CircleDollarSign, ListTree, LoaderCircle, Sparkles } from "lucide-react";
import { useState } from "react";

import { proposalLayouts, type ProposalLayout } from "@/lib/proposal-layouts";

const icons = { CLEAN: CheckCircle2, DETAILED: ListTree, PREMIUM: Sparkles };

export function ProposalLayoutSelector({ proposalId, initialLayout, onLayoutChange }: { proposalId: string; initialLayout: ProposalLayout; onLayoutChange?: (layout: ProposalLayout) => void }) {
  const [selected, setSelected] = useState<ProposalLayout>(initialLayout);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function choose(layout: ProposalLayout) {
    if (layout === selected || saving) return;
    const previous = selected;
    setSelected(layout);
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "set_layout", layout }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "We couldn’t save that layout.");
      setMessage(`${proposalLayouts.find((item) => item.id === layout)?.shortName} layout selected for the preview and PDF.`);
      onLayoutChange?.(layout);
    } catch (error) {
      setSelected(previous);
      setMessage(error instanceof Error ? error.message : "We couldn’t save that layout.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="proposal-layout-picker" aria-label="Proposal layout">
    <div className="proposal-layout-picker-head"><div><h2>Customer presentation</h2><p>Choose how this proposal should look before you send or download it.</p></div>{saving && <span><LoaderCircle className="spinner" size={14} /> Saving</span>}</div>
    <div className="proposal-layout-options">{proposalLayouts.map((layout) => { const Icon = icons[layout.id]; return <button type="button" key={layout.id} className={`proposal-layout-option ${selected === layout.id ? "selected" : ""}`} onClick={() => choose(layout.id)} aria-pressed={selected === layout.id}><span className={`proposal-layout-thumbnail ${layout.id.toLowerCase()}`}><Icon size={16} /><i /><i /><i /></span><b>{layout.name}</b><small>{layout.description}</small>{selected === layout.id && <em><CircleDollarSign size={12} /> Selected</em>}</button>; })}</div>
    {message && <p className="proposal-layout-message">{message}</p>}
  </section>;
}
