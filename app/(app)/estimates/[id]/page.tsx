import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app-shell";
import { ProposalActions } from "@/components/proposal-actions";
import { ProposalContactCard, ProposalDocument, type ProposalDocumentData } from "@/components/proposal-document";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function date(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined;
}

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const company = user.isDemo || !prisma ? null : await getCompanyForUser(user.id, user.companyId);
  if (!company) notFound();
  const estimate = await prisma!.estimate.findFirst({
    where: { id, companyId: company.id },
    include: { company: true, job: { include: { customer: true } }, items: { orderBy: { sortOrder: "asc" } }, proposal: true },
  });
  if (!estimate) notFound();
  const customer = estimate.job?.customer;
  const customerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : "Customer";
  const customerAddress = [customer?.address1, customer?.address2, [customer?.city, customer?.state, customer?.postalCode].filter(Boolean).join(" ")].filter(Boolean).join("\n") || undefined;
  const proposal = estimate.proposal;
  const total = estimate.totalCents / 100;
  const deposit = (proposal?.depositAmountCents ?? 0) / 100;
  const document: ProposalDocumentData = {
    number: String(estimate.number),
    title: estimate.job?.title ?? estimate.title,
    customer: { name: customerName, email: customer?.email, address: customerAddress },
    company: { name: estimate.company.name, email: estimate.company.email, phone: estimate.company.phone, address: estimate.company.address },
    jobAddress: estimate.job?.address,
    createdAt: date(estimate.createdAt),
    validUntil: date(estimate.validUntil ?? proposal?.expiresAt),
    depositPercent: total ? Math.round((deposit / total) * 100) : 0,
    deposit,
    subtotal: (estimate.materialSubtotalCents + estimate.laborSubtotalCents + estimate.equipmentSubtotalCents + estimate.disposalSubtotalCents + estimate.otherSubtotalCents) / 100,
    tax: estimate.taxCents / 100,
    total,
    scope: estimate.scopeOfWork,
    terms: proposal?.terms,
    lines: estimate.items.map((item) => ({ item: item.description, quantity: `${Number(item.quantity)} ${item.unit}`, amount: Math.round(Number(item.quantity) * item.unitPriceCents) / 100 })),
  };
  const status = proposal?.status ?? estimate.status;
  return <>
    <PageHeader title={`Proposal #${estimate.number}`} subtitle={`${customerName} · ${estimate.job?.title ?? estimate.title}`}>
      <StatusBadge status={status} />
      <Link href="/estimates" className="button button-outline button-sm"><ChevronLeft size={14} /> All proposals</Link>
    </PageHeader>
    <section className="proposal-layout"><ProposalDocument data={document} /><aside className="proposal-side"><article className="card side-card"><h2>Proposal actions</h2><p>Download the itemized PDF, mark the proposal sent, or copy the secure customer link.</p><div style={{ display: "grid", gap: 8 }}>{proposal ? <ProposalActions proposalId={proposal.id} publicToken={proposal.publicToken} customerName={customerName} /> : <p style={{ color: "var(--ink-soft)", fontSize: 11 }}>This legacy estimate has no proposal record yet.</p>}</div></article><article className="card side-card"><h2>Proposal timeline</h2><div className="timeline"><div className="timeline-item"><b>Created as a draft</b><small>{date(estimate.createdAt)}</small></div>{proposal?.sentAt && <div className="timeline-item"><b>Marked as sent</b><small>{date(proposal.sentAt)}</small></div>}{proposal?.viewedAt && <div className="timeline-item"><b>Viewed by client</b><small>{date(proposal.viewedAt)}</small></div>}{proposal?.acceptedAt && <div className="timeline-item"><b>Accepted by {proposal.acceptedByName || customerName}</b><small>{date(proposal.acceptedAt)}</small></div>}{!proposal?.sentAt && <div className="timeline-item"><b>Ready to share</b><small>Copy the customer link when you’re ready</small></div>}</div></article><ProposalContactCard contact={estimate.company} /><article className="card side-card"><div className="icon-box blue"><FileText /></div><h2 style={{ marginTop: 12 }}>PDF-ready scope</h2><p>The client, trade, site notes, materials, labor, terms, totals, and deposit are preserved in this proposal.</p></article></aside></section>
  </>;
}
