"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function JobDeleteButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeJob() {
    const confirmed = window.confirm(`Delete “${jobTitle}”? This permanently removes its estimates, proposal, and related payments.`);
    if (!confirmed) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "We couldn’t delete that job.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t delete that job.");
    } finally {
      setPending(false);
    }
  }

  return <span className="job-delete-wrap"><button type="button" className="icon-button job-delete-button" aria-label={`Delete ${jobTitle}`} title="Delete job" onClick={removeJob} disabled={pending}>{pending ? <LoaderCircle className="spinner" size={15} /> : <Trash2 size={15} />}</button>{error && <span className="job-delete-error" role="alert">{error}</span>}</span>;
}
