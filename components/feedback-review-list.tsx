"use client";

import { CheckCircle2, LoaderCircle, Save, XCircle } from "lucide-react";
import { useState } from "react";

type Feedback = { id: string; kind: "BUG" | "FEATURE"; status: string; title: string; details: string; pageUrl?: string | null; adminNotes?: string | null; createdAt: string; company: string; submittedBy: string };
type Draft = { status: string; adminNotes: string };
const statuses = ["NEW", "REVIEWING", "PLANNED", "RESOLVED", "CLOSED"];

export function FeedbackReviewList({ initialFeedback }: { initialFeedback: Feedback[] }) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(initialFeedback.map((item) => [item.id, { status: item.status, adminNotes: item.adminNotes ?? "" }])));
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; error?: boolean } | null>(null);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function save(item: Feedback, statusOverride?: string) {
    const draft = drafts[item.id] ?? { status: item.status, adminNotes: item.adminNotes ?? "" };
    const status = statusOverride ?? draft.status;
    setSaving(item.id);
    setMessage(null);
    try {
      const response = await fetch("/api/feedback", { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, status, adminNotes: draft.adminNotes }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Couldn’t save feedback review.");
      setFeedback((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: data.feedback.status, adminNotes: data.feedback.adminNotes } : entry));
      updateDraft(item.id, { status: data.feedback.status, adminNotes: data.feedback.adminNotes ?? "" });
      setMessage({ id: item.id, text: data.feedback.status === "CLOSED" ? "Request closed." : "Review saved." });
    } catch (error) {
      setMessage({ id: item.id, text: error instanceof Error ? error.message : "Couldn’t save feedback review.", error: true });
    } finally {
      setSaving(null);
    }
  }

  if (!feedback.length) return <div className="feedback-review-empty">No feedback submissions yet.</div>;
  return <div className="feedback-review-list">{feedback.map((item) => {
    const draft = drafts[item.id] ?? { status: item.status, adminNotes: item.adminNotes ?? "" };
    return <form className="feedback-review-item" key={item.id} onSubmit={(event) => { event.preventDefault(); void save(item); }}><div className="feedback-review-meta"><span className={`status ${item.kind === "BUG" ? "declined" : "viewed"}`}>{item.kind === "BUG" ? "Bug" : "Feature"}</span><b>{item.title}</b><small>{item.company} · {item.submittedBy} · {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></div><p>{item.details}</p>{item.pageUrl && <a className="text-link" href={item.pageUrl} target="_blank" rel="noreferrer">View reported page</a>}<div className="feedback-review-controls"><select name="status" value={draft.status} onChange={(event) => updateDraft(item.id, { status: event.target.value })}>{statuses.map((status) => <option value={status} key={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}</select><input name="adminNotes" value={draft.adminNotes} onChange={(event) => updateDraft(item.id, { adminNotes: event.target.value })} maxLength={4000} placeholder="Internal review notes" /><button className="button button-outline button-sm" disabled={saving === item.id}>{saving === item.id ? <LoaderCircle className="spinner" size={14} /> : <Save size={14} />} Save</button><button type="button" className="button button-ghost button-sm" disabled={saving === item.id || draft.status === "CLOSED"} onClick={() => void save(item, "CLOSED")}>{saving === item.id ? "Saving…" : <><XCircle size={14} /> Close request</>}</button></div>{message?.id === item.id && <p className={`feedback-review-message ${message.error ? "error" : ""}`} role="status">{message.error ? <XCircle size={14} /> : <CheckCircle2 size={14} />}{message.text}</p>}</form>;
  })}</div>;
}
