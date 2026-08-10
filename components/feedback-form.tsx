"use client";

import { Bug, CheckCircle2, Lightbulb, LoaderCircle } from "lucide-react";
import { useState } from "react";

type Kind = "BUG" | "FEATURE";

export function FeedbackForm() {
  const [kind, setKind] = useState<Kind>("BUG");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, title, details, pageUrl: window.location.href }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "We couldn’t submit that feedback.");
      setTitle("");
      setDetails("");
      setMessage("Thanks — your feedback has been sent to the ContractorCopilot team.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t submit that feedback.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="feedback-form">
    <div className="feedback-kind-switch" role="group" aria-label="Feedback type">
      <button type="button" className={kind === "BUG" ? "selected" : ""} onClick={() => setKind("BUG")}><Bug size={15} /> Report a bug</button>
      <button type="button" className={kind === "FEATURE" ? "selected" : ""} onClick={() => setKind("FEATURE")}><Lightbulb size={15} /> Request a feature</button>
    </div>
    <div className="field"><label htmlFor="feedback-title">Short summary</label><input id="feedback-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder={kind === "BUG" ? "What went wrong?" : "What would make ContractorCopilot better?"} /></div>
    <div className="field"><label htmlFor="feedback-details">Details</label><textarea id="feedback-details" value={details} onChange={(event) => setDetails(event.target.value)} maxLength={4000} required placeholder={kind === "BUG" ? "Tell us what you expected, what happened, and how to reproduce it." : "Describe the problem this would solve and how you imagine it working."} /></div>
    <div className="feedback-form-footer"><small>We automatically include the page you were on to help us investigate.</small><button className="button button-primary button-sm" disabled={pending}>{pending ? <><LoaderCircle className="spinner" /> Sending…</> : "Send feedback"}</button></div>
    {message && <p className="feedback-message"><CheckCircle2 size={15} />{message}</p>}
  </form>;
}
