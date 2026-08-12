"use client";

import Link from "next/link";
import { CheckCircle2, CreditCard, Download, FileAudio, ImagePlus, LoaderCircle, Plus, Sparkles, Trash2, WandSparkles } from "lucide-react";
import { ChangeEvent, useState } from "react";

import { aiDraft } from "@/lib/demo-data";
import { currency } from "@/lib/format";

type Line = { description: string; category: string; quantity: number; unit: string; amount: number };
type JobDetails = {
  customerName: string;
  customerEmail: string;
  trade: string;
  address: string;
  notes: string;
  materials: string;
  materialCost: string;
  laborHours: string;
  laborRate: string;
};

const tradeOptions = ["HVAC", "Roofing", "Custom Pool", "Plumbing", "Electrical", "Remodel", "Concrete & Masonry", "Landscaping"];

const demoJob: JobDetails = {
  customerName: "Olivia Martinez",
  customerEmail: "olivia.martinez@email.com",
  trade: "Landscaping",
  address: "1809 Bluebonnet Lane, Austin, TX 78704",
  notes: "Customer wants 120 feet of six-foot cedar privacy fence. One gate. Remove existing chain link. Ground is mostly level. They’d like the work completed before August 20.",
  materials: "Western red cedar fence boards, treated posts, concrete, exterior fasteners, and a walk-gate kit.",
  materialCost: "2842",
  laborHours: "20",
  laborRate: "95",
};

const blankJob: JobDetails = { customerName: "", customerEmail: "", trade: "HVAC", address: "", notes: "", materials: "", materialCost: "", laborHours: "", laborRate: "" };
const demoMeasurements = [{ label: "Fence length", quantity: "120", unit: "LF" }, { label: "Walk gates", quantity: "1", unit: "EA" }];

function fileNames(event: ChangeEvent<HTMLInputElement>, callback: (names: string[]) => void) {
  callback(Array.from(event.target.files ?? []).map((file) => file.name));
}

function moneyToCents(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined;
}

function positiveNumber(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export function EstimateWizard({ demo = false }: { demo?: boolean }) {
  const [job, setJob] = useState<JobDetails>(demo ? demoJob : blankJob);
  const [jobId, setJobId] = useState<string | null>(null);
  const [estimateId, setEstimateId] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState(demo ? demoMeasurements : [{ label: "", quantity: "", unit: "EA" }]);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [voiceNames, setVoiceNames] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [lines, setLines] = useState<Line[]>(demo ? aiDraft.lineItems : []);
  const [estimateTotal, setEstimateTotal] = useState<number | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const total = estimateTotal ?? lines.reduce((sum, line) => sum + line.amount, 0) * 1.1;

  function updateJob(field: keyof JobDetails, value: string) {
    setJob((current) => ({ ...current, [field]: value }));
  }

  function updateMeasurement(index: number, field: "label" | "quantity" | "unit", value: string) {
    setMeasurements((current) => current.map((measurement, idx) => idx === index ? { ...measurement, [field]: value } : measurement));
  }

  async function jsonRequest(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "We couldn’t complete that request.");
    return data;
  }

  async function uploadPhotos(activeJobId: string) {
    if (!photoFiles.length || demo) return photoNames.map((name) => `Jobsite photo attached: ${name}`);
    const form = new FormData();
    photoFiles.slice(0, 4).forEach((file) => form.append("photos", file));
    const response = await fetch(`/api/jobs/${encodeURIComponent(activeJobId)}/photos`, { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "We couldn’t upload the jobsite photos.");
    return Array.isArray(data.photos) ? data.photos.map((photo: { caption?: string }) => photo.caption || "Jobsite photo") : [];
  }

  async function generate() {
    if (!job.customerName.trim() || !job.trade || !job.notes.trim()) {
      setMessage("Add a client name, trade, and site notes before generating the proposal.");
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      let activeJobId = jobId;
      if (!activeJobId) {
        const createdJob = await jsonRequest("/api/jobs", {
          customerName: job.customerName,
          customerEmail: job.customerEmail,
          jobType: job.trade,
          trade: job.trade,
          address: job.address,
          notes: job.notes,
          materials: job.materials,
        });
        activeJobId = createdJob.id;
        setJobId(activeJobId);
      }
      if (!activeJobId) throw new Error("We couldnâ€™t create the job for these photos.");
      const photoSummaries = await uploadPhotos(activeJobId);
      const result = await jsonRequest("/api/ai/estimate", {
        title: `${job.trade} proposal`,
        trade: job.trade,
        jobDescription: `Site notes:\n${job.notes}${job.materials ? `\n\nMaterials:\n${job.materials}` : ""}`,
        measurements: measurements.filter((item) => item.label || item.quantity).map((item) => `${item.label || "Measurement"}: ${item.quantity || "0"} ${item.unit}`).join("\n"),
        photoSummaries,
        voiceTranscript: voiceNames.length ? `Voice note attached: ${voiceNames.join(", ")}` : undefined,
        manualPricing: {
          materials: job.materials || undefined,
          materialCostCents: moneyToCents(job.materialCost),
          laborHours: positiveNumber(job.laborHours),
          laborRateCents: moneyToCents(job.laborRate),
        },
        jobId: activeJobId,
        save: true,
      });
      if (Array.isArray(result.pricing?.lineItems)) {
        setLines(result.pricing.lineItems.map((item: { description: string; category: string; quantity: number; unit: string; lineTotalCents: number }) => ({ ...item, amount: item.lineTotalCents / 100 })));
      }
      setEstimateTotal(typeof result.pricing?.totalCents === "number" ? result.pricing.totalCents / 100 : null);
      setEstimateId(typeof result.estimateId === "string" ? result.estimateId : null);
      setProposalId(typeof result.proposalId === "string" ? result.proposalId : null);
      setPersisted(result.persisted === true);
      setGenerated(true);
      setMessage(result.persisted ? "Your proposal draft is saved with the client, scope, materials, labor, and pricing entered above." : "Your AI draft is ready to review. Connect PostgreSQL to save it permanently.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t generate that estimate.");
    } finally {
      setGenerating(false);
    }
  }

  async function downloadProposal() {
    if (!proposalId) return;
    setDownloading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/pdf`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "We couldn’t create that PDF.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${job.trade.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "proposal"}-proposal.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("Your proposal PDF is ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t create that PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return <>
    <div className="section-grid">
      <div style={{ display: "grid", gap: 16 }}>
        <section className="card form-card">
          <h2>Proposal scope</h2><p>Capture the client, trade, site notes, materials, and labor inputs that belong in the PDF.</p>
          <div className="form-grid">
            <div className="field"><label>Client name</label><input value={job.customerName} onChange={(event) => updateJob("customerName", event.target.value)} placeholder="Dana Whitfield" /></div>
            <div className="field"><label>Trade / job type</label><select value={job.trade} onChange={(event) => updateJob("trade", event.target.value)}>{tradeOptions.map((trade) => <option value={trade} key={trade}>{trade}</option>)}</select></div>
            <div className="field"><label>Client email</label><input type="email" value={job.customerEmail} onChange={(event) => updateJob("customerEmail", event.target.value)} placeholder="client@email.com" /></div>
            <div className="field"><label>Job address</label><input value={job.address} onChange={(event) => updateJob("address", event.target.value)} placeholder="Street, city, state" /></div>
            <div className="field full"><label>Site notes</label><textarea value={job.notes} onChange={(event) => updateJob("notes", event.target.value)} placeholder="Describe the work, site conditions, access, and requested outcome." /><div className="field-hint">Keywords are welcome—AI can expand shorthand such as “old 3-ton AC, attic, Wi-Fi thermostat” into a reviewable scope.</div></div>
            <div className="field full"><label>Materials</label><textarea value={job.materials} onChange={(event) => updateJob("materials", event.target.value)} placeholder="List key materials or shorthand, such as “cedar, posts, concrete, gate.”" /><div className="field-hint">Leave the cost blank to have AI build detailed planning line items from your material keywords.</div></div>
            <div className="field"><label>Material cost ($)</label><input type="number" min="0" step="0.01" inputMode="decimal" value={job.materialCost} onChange={(event) => updateJob("materialCost", event.target.value)} placeholder="0.00" /></div>
            <div className="field"><label>Labor hours</label><input type="number" min="0" step="0.25" inputMode="decimal" value={job.laborHours} onChange={(event) => updateJob("laborHours", event.target.value)} placeholder="0" /></div>
            <div className="field"><label>Rate ($/hr)</label><input type="number" min="0" step="0.01" inputMode="decimal" value={job.laborRate} onChange={(event) => updateJob("laborRate", event.target.value)} placeholder="95.00" /></div>
          </div>
        </section>

        <section className="card form-card">
          <h2>Site details</h2><p>Include measurements and attach the media you captured on site.</p>
          <div className="measurement-list">{measurements.map((measurement, index) => <div className="measurement-row" key={`${measurement.label}-${index}`}><input aria-label={`Measurement ${index + 1} label`} value={measurement.label} onChange={(event) => updateMeasurement(index, "label", event.target.value)} placeholder="Measurement" /><input aria-label={`Measurement ${index + 1} quantity`} value={measurement.quantity} onChange={(event) => updateMeasurement(index, "quantity", event.target.value)} placeholder="Qty" /><select aria-label={`Measurement ${index + 1} unit`} value={measurement.unit} onChange={(event) => updateMeasurement(index, "unit", event.target.value)}><option>LF</option><option>SF</option><option>EA</option><option>HR</option></select><button type="button" className="icon-button" aria-label="Remove measurement" onClick={() => setMeasurements((current) => current.length > 1 ? current.filter((_, idx) => idx !== index) : current)}><Trash2 size={14} /></button></div>)}</div>
          <button type="button" className="button button-ghost button-sm" style={{ marginTop: 10, paddingLeft: 0 }} onClick={() => setMeasurements((current) => [...current, { label: "", quantity: "", unit: "EA" }])}><Plus size={14} /> Add measurement</button>
          <div className="form-grid" style={{ marginTop: 17 }}>
            <label className="upload-zone"><div><span className="icon-box"><ImagePlus /></span><b>{photoNames.length ? `${photoNames.length} jobsite photo${photoNames.length === 1 ? "" : "s"} selected` : "Drop jobsite photos here"}</b><p>{photoNames.length ? photoNames.join(", ") : "JPG or PNG, up to 1.5 MB each"}</p></div><input type="file" accept="image/jpeg,image/png" multiple hidden onChange={(event) => { const files = Array.from(event.target.files ?? []); setPhotoFiles(files); setPhotoNames(files.map((file) => file.name)); }} /></label>
            <label className="upload-zone"><div><span className="icon-box blue"><FileAudio /></span><b>{voiceNames.length ? `${voiceNames.length} voice note selected` : "Record or upload a voice note"}</b><p>{voiceNames.length ? voiceNames.join(", ") : "Audio is prepared for transcription when storage is connected"}</p></div><input type="file" accept="audio/*" hidden onChange={(event) => fileNames(event, setVoiceNames)} /></label>
          </div>
        </section>

        <section className="card form-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}><div><h2>Build your proposal</h2><p style={{ marginBottom: 0 }}>AI organizes the scope. Your material and labor entries remain visible, itemized, and in your control.</p></div><button type="button" className="button button-primary" onClick={generate} disabled={generating}>{generating ? <><LoaderCircle className="spinner" /> Drafting…</> : <><WandSparkles size={15} /> Generate proposal</>}</button></div>
          {generated && <div className="ai-callout"><Sparkles /><div><b>Proposal draft ready</b><p>Review the itemized scope, materials, labor, and pricing before sharing it with your client.</p></div></div>}
          {generated && <div style={{ overflowX: "auto" }}><table className="data-table" style={{ marginTop: 13 }}><thead><tr><th>Line item</th><th>Category</th><th>Qty</th><th>Amount</th><th /></tr></thead><tbody>{lines.map((line, index) => <tr key={`${line.description}-${index}`}><td className="strong">{line.description}</td><td>{line.category}</td><td>{line.quantity} {line.unit}</td><td className="strong">{currency(line.amount, 2)}</td><td><button type="button" className="icon-button" aria-label={`Remove ${line.description}`} onClick={() => setLines((current) => current.filter((_, idx) => idx !== index))}><Trash2 size={13} /></button></td></tr>)}</tbody></table></div>}
        </section>
      </div>

      <aside className="card estimate-summary">
        <div className="estimate-summary-head"><h2>{generated ? "Proposal summary" : "Your proposal"}</h2><p>{generated ? "Review every line before sharing it with your client." : "Add the proposal scope, then generate your draft."}</p></div>
        {generated ? <><div className="summary-lines">{lines.map((line) => <div className="summary-line" key={line.description}><div><b>{line.description}</b><small>{line.quantity} {line.unit} · {line.category}</small></div><span>{currency(line.amount, 2)}</span></div>)}</div><div className="summary-total"><span>Estimated total<br /><small style={{ fontWeight: 500 }}>Price-book calculation</small></span><strong>{currency(total, 2)}</strong></div></> : <div style={{ padding: "28px 19px", textAlign: "center", color: "var(--ink-faint)" }}><Sparkles size={24} style={{ marginBottom: 8, color: "var(--orange)" }} /><div style={{ fontSize: 12, lineHeight: 1.5 }}>Your itemized scope and price breakdown will appear here.</div></div>}
        <div className="summary-actions">{generated && proposalId ? <><button type="button" className="button button-primary" onClick={downloadProposal} disabled={downloading}>{downloading ? <><LoaderCircle className="spinner" /> Creating PDF…</> : <><Download size={15} /> Download proposal PDF</>}</button>{estimateId && <Link href={`/estimates/${encodeURIComponent(estimateId)}`} className="button button-outline">Review proposal layout</Link>}</> : <button type="button" className="button button-primary" onClick={generate} disabled={generating}>{generating ? <><LoaderCircle className="spinner" /> Drafting…</> : <><WandSparkles size={15} /> Generate to continue</>}</button>}</div>
        <div className="payment-disclaimer"><CreditCard size={15} /><p><b>Payments and payouts</b> Online deposits only work after your Stripe Connect payout account is set up. Until then, collect payments separately through your preferred payment platform; this proposal does not move money on its own.</p></div>
        {persisted && <p style={{ padding: "0 20px 20px", margin: 0, color: "var(--teal)", fontSize: 11 }}>Saved securely in this workspace.</p>}
      </aside>
    </div>
    {message && <div className="toast"><CheckCircle2 />{message}</div>}
  </>;
}
