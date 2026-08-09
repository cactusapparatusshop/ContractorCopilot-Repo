import Link from "next/link";
import { ArrowUpRight, CalendarDays, CheckCircle2, FileText, Plus, Sparkles, WalletCards } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { DocumentUsageBanner } from "@/components/document-usage-banner";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";
import { firstName, viewerInitials } from "@/lib/workspace";

const metricIcons = [FileText, CheckCircle2, WalletCards, ArrowUpRight];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const company = user.isDemo || !prisma ? null : await getCompanyForUser(user.id, user.companyId);
  const estimates = company
    ? await prisma!.estimate.findMany({
      where: { companyId: company.id },
      include: { job: { include: { customer: true } }, proposal: true },
      orderBy: { updatedAt: "desc" },
      take: 8,
    })
    : [];
  const totalPipeline = estimates.filter((estimate) => !["DECLINED", "EXPIRED"].includes(estimate.status)).reduce((sum, estimate) => sum + estimate.totalCents, 0);
  const decisioned = estimates.filter((estimate) => ["ACCEPTED", "DECLINED"].includes(estimate.status));
  const accepted = decisioned.filter((estimate) => estimate.status === "ACCEPTED").length;
  const pendingDeposits = estimates.filter((estimate) => estimate.proposal?.status === "ACCEPTED").reduce((sum, estimate) => sum + (estimate.proposal?.depositAmountCents ?? 0), 0);
  const thisMonth = new Date();
  const acceptedThisMonth = estimates.filter((estimate) => estimate.status === "ACCEPTED" && estimate.updatedAt.getMonth() === thisMonth.getMonth() && estimate.updatedAt.getFullYear() === thisMonth.getFullYear()).reduce((sum, estimate) => sum + estimate.totalCents, 0);
  const currency = company?.currency ?? "usd";
  const metrics = [
    { label: "Pipeline value", value: formatMoney(totalPipeline, currency), detail: estimates.length ? `${estimates.length} active proposal${estimates.length === 1 ? "" : "s"}` : "No proposals yet" },
    { label: "Win rate", value: decisioned.length ? `${Math.round((accepted / decisioned.length) * 100)}%` : "—", detail: decisioned.length ? `${accepted} accepted of ${decisioned.length}` : "No decisions yet" },
    { label: "Pending deposits", value: formatMoney(pendingDeposits, currency), detail: pendingDeposits ? "Accepted proposals awaiting payment" : "No deposits due" },
    { label: "Accepted this month", value: formatMoney(acceptedThisMonth, currency), detail: acceptedThisMonth ? "Accepted project value" : "No accepted projects yet" },
  ];

  return <>
    <PageHeader title={`Good morning, ${firstName(user.name, user.email)}`} subtitle={company ? `Here’s what’s happening with ${company.name}.` : "This preview workspace does not store data."}>
      <span className="date-control"><CalendarDays size={14} /> {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date())}</span>
      <Link href="/jobs/new" className="button button-primary"><Plus size={15} /> Create proposal</Link>
    </PageHeader>
    <DocumentUsageBanner />
    <section className="metric-grid">
      {metrics.map((metric, index) => {
        const Icon = metricIcons[index];
        return <article className="card metric-card" key={metric.label}><div className="metric-card-top"><span className="metric-label">{metric.label}</span><span className={`icon-box ${index === 1 ? "blue" : index === 2 ? "purple" : index === 3 ? "teal" : ""}`}><Icon /></span></div><strong className="metric-value">{metric.value}</strong><span className="metric-delta"><ArrowUpRight size={12} />{metric.detail}</span></article>;
      })}
    </section>
    <section className="dashboard-grid">
      <article className="card table-card" style={{ marginTop: 0 }}>
        <div className="card-heading"><div><h2>Recent proposals</h2><p>Everything created in this workspace appears here.</p></div><Link className="text-link" href="/estimates">View all proposals →</Link></div>
        {estimates.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Client</th><th>Project</th><th>Proposal</th><th>Status</th><th>Total</th><th /></tr></thead><tbody>{estimates.map((estimate) => {
          const customerName = estimate.job?.customer ? [estimate.job.customer.firstName, estimate.job.customer.lastName].filter(Boolean).join(" ") : "Client";
          return <tr key={estimate.id}><td><div className="customer-cell"><span className="table-avatar">{viewerInitials(customerName)}</span><span className="strong">{customerName}</span></div></td><td>{estimate.job?.title ?? estimate.title}</td><td className="strong">#{estimate.number}</td><td><StatusBadge status={estimate.proposal?.status ?? estimate.status} /></td><td className="strong">{formatMoney(estimate.totalCents, estimate.currency)}</td><td><Link href={`/estimates/${estimate.id}`} className="text-link">Open</Link></td></tr>;
        })}</tbody></table></div> : <div className="empty-state"><Sparkles size={22} /><h3>Your workspace is ready</h3><p>Create your first proposal to start building a private client, job, and proposal history.</p><Link href="/jobs/new" className="button button-primary button-sm">Create your first proposal</Link></div>}
      </article>
      <aside style={{ display: "grid", alignContent: "start", gap: 16 }}>
        <article className="card side-card"><div className="icon-box teal"><CheckCircle2 /></div><h2 style={{ marginTop: 12 }}>Private by workspace</h2><p>Your jobs, customers, proposal settings, and document credits are scoped to {company?.name || "this preview"}. Other accounts cannot see them.</p></article>
        <article className="ai-callout" style={{ margin: 0 }}><Sparkles /><div><b>Start from the site walk</b><p>Add the client, trade, site notes, materials, labor hours, and rate. ContractorCopilot turns them into a reviewable proposal PDF.</p><Link href="/jobs/new" className="text-link" style={{ display: "inline-block", marginTop: 6 }}>Open proposal builder →</Link></div></article>
      </aside>
    </section>
  </>;
}
