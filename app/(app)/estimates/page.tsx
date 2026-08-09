import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";
import { viewerInitials } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const user = await requireUser();
  const company = user.isDemo || !prisma ? null : await getCompanyForUser(user.id, user.companyId);
  const estimates = company ? await prisma!.estimate.findMany({
    where: { companyId: company.id },
    include: { job: { include: { customer: true } }, proposal: true },
    orderBy: { updatedAt: "desc" },
  }) : [];
  return <>
    <PageHeader title="Proposals" subtitle="Review, download, send, and track every proposal in this workspace."><Link href="/jobs/new" className="button button-primary"><Plus size={15} /> New proposal</Link></PageHeader>
    <section className="card" style={{ overflow: "hidden" }}>
      {estimates.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Proposal</th><th>Client</th><th>Project</th><th>Created</th><th>Status</th><th>Total</th></tr></thead><tbody>{estimates.map((estimate) => {
        const client = estimate.job?.customer ? [estimate.job.customer.firstName, estimate.job.customer.lastName].filter(Boolean).join(" ") : "Client";
        return <tr key={estimate.id}><td><Link className="strong text-link" href={`/estimates/${estimate.id}`}>#{estimate.number}</Link></td><td><div className="customer-cell"><span className="table-avatar">{viewerInitials(client)}</span><span>{client}</span></div></td><td>{estimate.job?.title ?? estimate.title}</td><td>{estimate.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><StatusBadge status={estimate.proposal?.status ?? estimate.status} /></td><td className="strong">{formatMoney(estimate.totalCents, estimate.currency)}</td></tr>;
      })}</tbody></table></div> : <div className="empty-state"><FileText size={24} /><h3>No proposals yet</h3><p>When you generate your first proposal, it will be saved here with an itemized PDF.</p><Link href="/jobs/new" className="button button-primary button-sm">Create proposal</Link></div>}
    </section>
  </>;
}
