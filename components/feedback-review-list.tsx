"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useState } from "react";

type Feedback = { id: string; kind: "BUG" | "FEATURE"; status: string; title: string; details: string; pageUrl?: string | null; adminNotes?: string | null; createdAt: string; company: string; submittedBy: string };
const statuses = ["NEW", "REVIEWING", "PLANNED", "RESOLVED", "CLOSED"];

export function FeedbackReviewList({ initialFeedback }: { initialFeedback: Feedback[] }) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [saving, setSaving] = useState<string | null>(null);
  async function save(item: Feedback, form: HTMLFormElement) {
    const values = new FormData(form);
    const status = String(values.get("status"));
    const adminNotes = String(values.get("adminNotes") ?? "");
    setSaving(item.id);
    try {
      const response = await fetch("/api/feedback", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: item.id, status, adminNotes }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Couldn’t save feedback review.");
      setFeedback((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: data.feedback.status, adminNotes: data.feedback.adminNotes } : entry));
    } finally { setSaving(null); }
  }
  if (!feedback.length) return <div className="feedback-review-empty">No feedback submissions yet.</div>;
  return <div className="feedback-review-list">{feedback.map((item) => <form className="feedback-review-item" key={item.id} onSubmit={(event) => { event.preventDefault(); void save(item, event.currentTarget); }}><div className="feedback-review-meta"><span className={`status ${item.kind === "BUG" ? "declined" : "viewed"}`}>{item.kind === "BUG" ? "Bug" : "Feature"}</span><b>{item.title}</b><small>{item.company} · {item.submittedBy} · {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></div><p>{item.details}</p>{item.pageUrl && <a className="text-link" href={item.pageUrl} target="_blank" rel="noreferrer">View reported page</a>}<div className="feedback-review-controls"><select name="status" defaultValue={item.status}>{statuses.map((status) => <option value={status} key={status}>{status[0] + status.slice(1).toLowerCase()}</option>)}</select><input name="adminNotes" defaultValue={item.adminNotes ?? ""} maxLength={4000} placeholder="Internal review notes" /><button className="button button-outline button-sm" disabled={saving === item.id}>{saving === item.id ? <LoaderCircle className="spinner" size={14} /> : <Save size={14} />} Save</button></div></form>)}</div>;
}
