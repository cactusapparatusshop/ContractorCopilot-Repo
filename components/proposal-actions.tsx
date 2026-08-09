"use client";

import { CheckCircle2, Download, ExternalLink, LoaderCircle, Mail, Send } from "lucide-react";
import { useState } from "react";

export function ProposalActions({ proposalId, publicToken, customerName }: { proposalId: string; publicToken: string; customerName: string }) {
  const [pending, setPending] = useState<"send" | "followup" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function notify(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3000);
  }
  async function action(kind: "send" | "followup") {
    setPending(kind);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: kind === "send" ? "send" : "follow_up" }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "We couldn’t complete that action.");
      notify(data.message ?? "Proposal updated.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "We couldn’t complete that action.");
    } finally {
      setPending(null);
    }
  }
  async function copyLink() {
    const url = `${window.location.origin}/p/${encodeURIComponent(publicToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      notify("Secure customer link copied to your clipboard.");
    } catch {
      notify(`Customer link: ${url}`);
    }
  }
  return <><button type="button" className="button button-primary" onClick={() => action("send")} disabled={pending !== null}>{pending === "send" ? <><LoaderCircle className="spinner" /> Sending…</> : <><Send size={15} /> Mark as sent</>}</button><button type="button" className="button button-outline" onClick={copyLink}><ExternalLink size={15} /> Copy customer link</button><a className="button button-outline" href={`/api/proposals/${encodeURIComponent(proposalId)}/pdf`} target="_blank"><Download size={15} /> Download PDF</a><button type="button" className="button button-ghost" style={{ marginTop: 2 }} onClick={() => action("followup")} disabled={pending !== null}>{pending === "followup" ? <><LoaderCircle className="spinner" /> Saving…</> : <><Mail size={14} /> Schedule follow-up</>}</button>{message && <div className="toast"><CheckCircle2 />{message}</div>}<p style={{ margin: "4px 0 0", color: "var(--ink-faint)", fontSize: 10 }}>Share the link with {customerName}; payment only becomes available after approval.</p></>;
}
