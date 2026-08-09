"use client";

import { CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { currency } from "@/lib/format";

type PortalActionsProps = {
  token: string;
  customerName: string;
  customerEmail?: string | null;
  depositAmount: number;
};

export function PortalActions({ token, customerName, customerEmail, depositAmount }: PortalActionsProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState<"accept" | "pay" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function accept() {
    setLoading("accept");
    setNotice(null);
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signerName: customerName, signerEmail: customerEmail, acceptedTerms: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "We couldn’t approve this proposal.");
      setAccepted(true);
      setNotice("Proposal approved—your contractor has been notified.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We couldn’t approve this proposal.");
    } finally {
      setLoading(null);
    }
  }

  async function pay() {
    setLoading("pay");
    setNotice(null);
    try {
      const response = await fetch(`/api/portal/${encodeURIComponent(token)}/deposit`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "We couldn’t start secure checkout.");
      if (data.url) window.location.assign(data.url);
      else throw new Error("We couldn’t start secure checkout.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "We couldn’t start secure checkout.");
    } finally {
      setLoading(null);
    }
  }

  return <>
    {!accepted ? <button className="button button-primary" onClick={accept} disabled={loading !== null}>{loading === "accept" ? <><LoaderCircle className="spinner" /> Approving…</> : <><CheckCircle2 size={15} /> Approve proposal</>}</button> : <div style={{ marginTop: 15, padding: 10, borderRadius: 8, background: "rgba(125,224,203,.13)", color: "#9cead6", fontSize: 11, fontWeight: 700 }}><CheckCircle2 size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} /> Proposal approved</div>}
    <button className="button button-outline" style={{ color: "var(--navy)", background: "white" }} onClick={pay} disabled={loading !== null}>{loading === "pay" ? <><LoaderCircle className="spinner" /> Opening checkout…</> : <>Pay {currency(depositAmount, 2)} deposit</>}</button>
    <div className="portal-trust"><LockKeyhole size={11} /> Payments are securely processed by Stripe.</div>
    {notice && <div className="toast"><CheckCircle2 />{notice}</div>}
  </>;
}
