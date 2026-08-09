"use client";

import { Bell, Building2, CheckCircle2, Palette, Save, UserRound, UsersRound } from "lucide-react";
import { useState } from "react";
import { TwoFactorSettings } from "@/components/account-security-forms";

export type SettingsFormData = {
  account: { name: string; email: string };
  company: {
    name: string;
    email: string;
    phone: string;
    address: string;
    defaultDepositPercent: number;
    defaultProposalValidityDays: number;
    defaultWarrantyText: string;
    notificationsEnabled: boolean;
    role: string;
  };
  team: { id: string; name: string | null; email: string; role: string }[];
  security: { twoFactorEnabled: boolean; available: boolean };
  preview?: boolean;
};

type SaveKind = "account" | "company" | "proposal" | "notifications" | null;

export function SettingsForm({ initial }: { initial: SettingsFormData }) {
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState<SaveKind>(null);
  const [notice, setNotice] = useState<string | null>(initial.preview ? "Preview settings are read-only. Create an account to save your own workspace settings." : null);

  function updateAccount(name: string) {
    setData((current) => ({ ...current, account: { ...current.account, name } }));
  }
  function updateCompany<K extends keyof SettingsFormData["company"]>(key: K, value: SettingsFormData["company"][K]) {
    setData((current) => ({ ...current, company: { ...current.company, [key]: value } }));
  }
  async function save(section: Exclude<SaveKind, null>, notificationsOverride?: boolean) {
    if (data.preview) return;
    setSaving(section);
    setNotice(null);
    try {
      const body = section === "account"
        ? { section, name: data.account.name }
        : section === "company"
          ? { section, companyName: data.company.name, companyEmail: data.company.email, companyPhone: data.company.phone, companyAddress: data.company.address }
          : section === "proposal"
            ? { section, defaultDepositPercent: data.company.defaultDepositPercent, defaultProposalValidityDays: data.company.defaultProposalValidityDays, defaultWarrantyText: data.company.defaultWarrantyText }
            : { section, notificationsEnabled: notificationsOverride ?? data.company.notificationsEnabled };
      const response = await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "We couldn’t save those settings.");
      setData((current) => ({ ...current, account: result.account, company: { ...current.company, ...result.company } }));
      setNotice("Saved to this workspace.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We couldn’t save those settings.");
    } finally {
      setSaving(null);
    }
  }

  return <>
    <section className="section-grid">
      <div style={{ display: "grid", gap: 16 }}>
        <article className="card form-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><span className="icon-box"><Building2 /></span><div><h2 style={{ margin: 0 }}>Company profile</h2><p style={{ margin: 2 }}>This appears on proposals and in your customer portal.</p></div></div>
          <div className="form-grid">
            <div className="field"><label>Company name</label><input value={data.company.name} onChange={(event) => updateCompany("name", event.target.value)} /></div>
            <div className="field"><label>Business phone</label><input value={data.company.phone} onChange={(event) => updateCompany("phone", event.target.value)} /></div>
            <div className="field full"><label>Business email</label><input type="email" value={data.company.email} onChange={(event) => updateCompany("email", event.target.value)} /></div>
            <div className="field full"><label>Business address</label><input value={data.company.address} onChange={(event) => updateCompany("address", event.target.value)} /></div>
          </div>
          <button type="button" className="button button-primary" style={{ marginTop: 16 }} onClick={() => save("company")} disabled={saving !== null}>{saving === "company" ? "Saving…" : <><Save size={14} /> Save company profile</>}</button>
        </article>
        <article className="card form-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><span className="icon-box purple"><Palette /></span><div><h2 style={{ margin: 0 }}>Proposal defaults</h2><p style={{ margin: 2 }}>Set the deposit, quote validity, and customer-facing warranty text.</p></div></div>
          <div className="form-grid">
            <div className="field"><label>Default deposit (%)</label><input type="number" min="0" max="100" value={data.company.defaultDepositPercent} onChange={(event) => updateCompany("defaultDepositPercent", Math.max(0, Math.min(100, Number(event.target.value || 0))))} /></div>
            <div className="field"><label>Quote validity (days)</label><input type="number" min="1" max="365" value={data.company.defaultProposalValidityDays} onChange={(event) => updateCompany("defaultProposalValidityDays", Math.max(1, Math.min(365, Number(event.target.value || 1))))} /></div>
            <div className="field full"><label>Default warranty wording</label><textarea value={data.company.defaultWarrantyText} onChange={(event) => updateCompany("defaultWarrantyText", event.target.value)} placeholder="Describe the workmanship warranty your customers should see." /></div>
          </div>
          <button type="button" className="button button-primary" style={{ marginTop: 16 }} onClick={() => save("proposal")} disabled={saving !== null}>{saving === "proposal" ? "Saving…" : <><Save size={14} /> Save proposal defaults</>}</button>
        </article>
      </div>
      <aside style={{ display: "grid", alignContent: "start", gap: 16 }}>
        <article className="card side-card">
          <div className="icon-box teal"><UserRound /></div><h2 style={{ marginTop: 12 }}>Your account</h2>
          <div className="field" style={{ marginTop: 14 }}><label>Display name</label><input value={data.account.name} onChange={(event) => updateAccount(event.target.value)} /></div>
          <p style={{ marginTop: 9 }}>{data.account.email}</p>
          <button type="button" className="button button-outline button-sm" style={{ width: "100%" }} onClick={() => save("account")} disabled={saving !== null}>{saving === "account" ? "Saving…" : "Save account name"}</button>
        </article>
        <TwoFactorSettings initialEnabled={data.security.twoFactorEnabled} available={data.security.available} preview={data.preview} />
        <article className="card side-card">
          <div className="icon-box blue"><Bell /></div><h2 style={{ marginTop: 12 }}>Notifications</h2><p>Control whether this workspace shows activity notifications in the bell menu.</p>
          <button type="button" className={`button ${data.company.notificationsEnabled ? "button-primary" : "button-outline"} button-sm`} style={{ width: "100%" }} onClick={() => { const next = !data.company.notificationsEnabled; updateCompany("notificationsEnabled", next); void save("notifications", next); }} disabled={saving !== null}>{saving === "notifications" ? "Saving…" : data.company.notificationsEnabled ? "Notifications on" : "Notifications off"}</button>
        </article>
        <article className="card side-card">
          <div className="icon-box blue"><UsersRound /></div><h2 style={{ marginTop: 12 }}>Team access</h2><p>{data.team.length === 1 ? "You are the only member of this workspace." : `${data.team.length} people can access this workspace.`}</p>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>{data.team.map((member) => <div key={member.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "9px 0", borderTop: "1px solid var(--line)", fontSize: 11 }}><span><b style={{ display: "block" }}>{member.name || member.email}</b><small>{member.email}</small></span><span className="status viewed">{member.role.toLowerCase()}</span></div>)}</div>
        </article>
      </aside>
    </section>
    {notice && <div className="toast"><CheckCircle2 />{notice}</div>}
  </>;
}
