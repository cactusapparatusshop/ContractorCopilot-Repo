import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { company as demoCompany, proposal as demoProposal } from "@/lib/demo-data";
import { currency } from "@/lib/format";
import type { PublicProposalData } from "@/lib/proposals";
import { MiniProductMark } from "@/components/app-shell";
import type { ProposalLayout } from "@/lib/proposal-layouts";

export type ProposalDocumentData = {
  number: string;
  title: string;
  customer: { name: string; email?: string | null; address?: string | null };
  company: { name: string; email?: string | null; phone?: string | null; address?: string | null };
  jobAddress?: string | null;
  createdAt?: string;
  validUntil?: string;
  depositPercent: number;
  deposit: number;
  subtotal: number;
  tax: number;
  total: number;
  scope: string;
  terms?: string | null;
  layout?: ProposalLayout;
  lines: { item: string; quantity: string; amount: number }[];
};

export const demoProposalDocument: ProposalDocumentData = {
  number: demoProposal.number,
  title: demoProposal.title,
  customer: demoProposal.customer,
  company: demoCompany,
  jobAddress: demoProposal.jobAddress,
  createdAt: demoProposal.createdAt,
  validUntil: demoProposal.validUntil,
  depositPercent: demoProposal.depositPercent,
  deposit: demoProposal.deposit,
  subtotal: demoProposal.subtotal,
  tax: demoProposal.tax,
  total: demoProposal.total,
  scope: demoProposal.scope,
  terms: "The remaining balance is due upon final walkthrough. Northstar Fencing Co. warrants workmanship for one year; manufacturer material warranties remain in effect as provided.",
  lines: demoProposal.lines,
};

export function proposalDocumentFromPublic(data: PublicProposalData): ProposalDocumentData {
  const total = data.totals.totalCents / 100;
  const deposit = (data.depositAmountCents ?? 0) / 100;
  return {
    number: data.proposalNumber,
    title: data.job.title,
    customer: data.customer,
    company: data.company,
    jobAddress: data.job.address,
    createdAt: data.createdAt,
    validUntil: data.validUntil,
    depositPercent: total > 0 ? Math.round((deposit / total) * 100) : 0,
    deposit,
    subtotal: data.totals.subtotalCents / 100,
    tax: data.totals.taxCents / 100,
    total,
    scope: data.scopeOfWork,
    terms: data.terms,
    layout: data.layout,
    lines: data.lineItems.map((line) => ({ item: line.description, quantity: `${line.quantity} ${line.unit}`, amount: line.lineTotalCents / 100 })),
  };
}

export function ProposalDocument({ portal = false, data = demoProposalDocument, layout }: { portal?: boolean; data?: ProposalDocumentData; layout?: ProposalLayout }) {
  const paperClass = portal ? "portal-paper" : "proposal-paper";
  const selectedLayout = layout ?? data.layout ?? "CLEAN";
  const customerAddress = data.customer.address?.split("\n").filter(Boolean) ?? [];
  return <article className={`${paperClass} proposal-layout-${selectedLayout.toLowerCase()}`}>
    <div className="proposal-paper-head"><MiniProductMark /><div className="proposal-meta"><b style={{ color: "var(--ink)" }}>PROPOSAL {data.number}</b><br />{data.createdAt && <>Created {data.createdAt}<br /></>}Valid through {data.validUntil ?? "the stated expiration date"}</div></div>
    {selectedLayout === "PREMIUM" && <div className="proposal-premium-banner"><span>TAILORED PROJECT PROPOSAL</span><b>A clear plan for a job done right.</b></div>}
    <h1>{data.title}</h1><p className="proposal-subtitle">Prepared for {data.customer.name} &middot; {data.jobAddress ?? "Project address on file"}</p>
    <div className="proposal-addresses"><div><b>Prepared for</b><p>{data.customer.name}<br />{data.customer.email}<br />{customerAddress.map((line) => <span key={line}>{line}<br /></span>)}</p></div><div><b>Prepared by</b><p>{data.company.name}<br />{data.company.phone}<br />{data.company.email}<br />{data.company.address}</p></div></div>
    <section className="proposal-scope"><h2>Scope of work</h2><p>{data.scope}</p></section>
    <table className="proposal-table"><thead><tr><th>Description</th><th>Quantity</th>{selectedLayout === "DETAILED" && <th>Pricing</th>}<th>Amount</th></tr></thead><tbody>{data.lines.map((line) => <tr key={`${line.item}-${line.quantity}`}><td>{line.item}</td><td>{line.quantity}</td>{selectedLayout === "DETAILED" && <td>Included</td>}<td>{currency(line.amount, 2)}</td></tr>)}</tbody></table>
    <div className="proposal-total"><div><span>Subtotal</span><span>{currency(data.subtotal, 2)}</span></div><div><span>Sales tax</span><span>{currency(data.tax, 2)}</span></div><div><span>Total project investment</span><span>{currency(data.total, 2)}</span></div></div>
    <section style={{ marginTop: 42, paddingTop: 23, borderTop: "1px solid var(--line)" }}><h2 style={{ margin: "0 0 7px", fontSize: 14 }}>Terms &amp; warranty</h2><p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 11, lineHeight: 1.65 }}>A {data.depositPercent}% deposit is due to reserve your installation date. {data.terms ?? "The remaining balance is due upon final walkthrough."}</p>{portal && <p style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 15, color: "var(--teal)", fontSize: 11, fontWeight: 700 }}><CheckCircle2 size={15} /> Your acceptance is recorded securely with this proposal.</p>}</section>
  </article>;
}

export function ProposalContactCard({ contact = demoCompany }: { contact?: { email?: string | null; phone?: string | null; address?: string | null } }) {
  return <article className="card side-card"><h2>Questions about this project?</h2><p>Your contractor is available to walk through the scope, materials, or timing with you.</p><div style={{ display: "grid", gap: 8, color: "var(--ink-soft)", fontSize: 11 }}><span><Mail size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />{contact.email}</span><span><Phone size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />{contact.phone}</span><span><MapPin size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />{contact.address}</span></div></article>;
}
