"use client";

import { CheckCircle2, CircleDollarSign, Gem, ListTree, LoaderCircle, PenLine, Ruler, Sparkles } from "lucide-react";
import { useState } from "react";

import { proposalLayouts, type ProposalLayout } from "@/lib/proposal-layouts";

const icons = { CLEAN: CheckCircle2, DETAILED: ListTree, PREMIUM: Sparkles, EXECUTIVE: Gem, BLUEPRINT: Ruler, SIGNATURE: PenLine };

export function ProposalLayoutSelector({ proposalId, initialLayout, initialCustomerCompanyName, initialCustomerLogoDataUrl, initialShowCustomerLogo, onLayoutChange, onCustomerBrandChange }: { proposalId: string; initialLayout: ProposalLayout; initialCustomerCompanyName?: string | null; initialCustomerLogoDataUrl?: string | null; initialShowCustomerLogo?: boolean; onLayoutChange?: (layout: ProposalLayout) => void; onCustomerBrandChange?: (brand: { customerCompanyName?: string | null; customerLogoDataUrl?: string | null; showCustomerLogo: boolean }) => void }) {
  const [selected, setSelected] = useState<ProposalLayout>(initialLayout);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [customerCompanyName, setCustomerCompanyName] = useState(initialCustomerCompanyName ?? "");
  const [customerLogoDataUrl, setCustomerLogoDataUrl] = useState(initialCustomerLogoDataUrl ?? "");
  const [showCustomerLogo, setShowCustomerLogo] = useState(initialShowCustomerLogo ?? false);

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

  async function saveCustomerBrand(next: { customerCompanyName?: string; customerLogoDataUrl?: string; showCustomerLogo: boolean }) {
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_customer_brand", ...next }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "We couldn’t save the customer brand.");
      setCustomerCompanyName(data.customerCompanyName ?? ""); setCustomerLogoDataUrl(data.customerLogoDataUrl ?? ""); setShowCustomerLogo(data.showCustomerLogo === true);
      onCustomerBrandChange?.({ customerCompanyName: data.customerCompanyName, customerLogoDataUrl: data.customerLogoDataUrl, showCustomerLogo: data.showCustomerLogo === true });
      setMessage("Customer brand updated for the preview, customer portal, and PDF.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "We couldn’t save the customer brand."); } finally { setSaving(false); }
  }

  function selectLogo(file?: File) {
    if (!file) return;
    if (!new Set(["image/jpeg", "image/png"]).has(file.type) || file.size > 80_000) { setMessage("Use a JPG or PNG logo no larger than 80 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const logo = typeof reader.result === "string" ? reader.result : ""; setCustomerLogoDataUrl(logo); void saveCustomerBrand({ customerCompanyName, customerLogoDataUrl: logo, showCustomerLogo: true }); };
    reader.readAsDataURL(file);
  }

  return <section className="proposal-layout-picker" aria-label="Proposal layout">
    <div className="proposal-layout-picker-head"><div><h2>Customer presentation</h2><p>Choose how this proposal should look before you send or download it.</p></div>{saving && <span><LoaderCircle className="spinner" size={14} /> Saving</span>}</div>
    <div className="proposal-layout-options">{proposalLayouts.map((layout) => { const Icon = icons[layout.id]; return <button type="button" key={layout.id} className={`proposal-layout-option ${selected === layout.id ? "selected" : ""}`} onClick={() => choose(layout.id)} aria-pressed={selected === layout.id}><span className={`proposal-layout-thumbnail ${layout.id.toLowerCase()}`}><Icon size={16} /><i /><i /><i /></span><b>{layout.name}</b><small>{layout.description}</small>{selected === layout.id && <em><CircleDollarSign size={12} /> Selected</em>}</button>; })}</div>
    {message && <p className="proposal-layout-message">{message}</p>}
    <div className="customer-brand-picker"><div><h3>Customer company logo <small>Optional</small></h3><p>Add the customer’s name and a small logo only when they’ve approved its use.</p></div><div className="customer-brand-controls"><input value={customerCompanyName} onChange={(event) => setCustomerCompanyName(event.target.value)} onBlur={() => void saveCustomerBrand({ customerCompanyName, customerLogoDataUrl, showCustomerLogo })} maxLength={160} placeholder="Customer company name" /><label className="button button-outline button-sm">{customerLogoDataUrl ? "Replace logo" : "Upload logo"}<input type="file" hidden accept="image/jpeg,image/png" onChange={(event) => selectLogo(event.target.files?.[0])} /></label>{customerLogoDataUrl && <label className="customer-logo-toggle"><input type="checkbox" checked={showCustomerLogo} onChange={(event) => { const visible = event.target.checked; setShowCustomerLogo(visible); void saveCustomerBrand({ customerCompanyName, customerLogoDataUrl, showCustomerLogo: visible }); }} /> Include on proposal</label>}</div></div>
  </section>;
}
