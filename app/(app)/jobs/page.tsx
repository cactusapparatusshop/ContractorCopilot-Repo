import Link from "next/link";
import { CalendarDays, ChevronRight, HardHat, Plus } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { JobDeleteButton } from "@/components/job-delete-button";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";
import { viewerInitials } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const user = await requireUser();
  const company = user.isDemo || !prisma ? null : await getCompanyForUser(user.id, user.companyId);
  const jobs = company ? await prisma!.job.findMany({
    where: { companyId: company.id },
    include: { customer: true, estimates: { orderBy: { updatedAt: "desc" }, take: 1, include: { proposal: true } } },
    orderBy: { updatedAt: "desc" },
  }) : [];
  return <>
    <PageHeader title="Jobs" subtitle="All your walkthroughs, scopes, and proposals in one private workspace."><Link href="/jobs/new" className="button button-primary"><Plus size={15} /> Create proposal</Link></PageHeader>
    <section className="card" style={{ overflow: "hidden" }}>
      <div className="list-toolbar"><span><HardHat size={15} /> {jobs.length} job{jobs.length === 1 ? "" : "s"}</span><span><CalendarDays size={14} /> Ordered by most recently updated</span></div>
      {jobs.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Job</th><th>Client</th><th>Address</th><th>Proposal</th><th>Status</th><th>Updated</th><th /><th /></tr></thead><tbody>{jobs.map((job) => {
        const estimate = job.estimates[0];
        const client = [job.customer.firstName, job.customer.lastName].filter(Boolean).join(" ");
        const status = estimate?.proposal?.status ?? estimate?.status ?? job.status;
        const destination = estimate ? `/estimates/${estimate.id}` : "/jobs/new";
        return <tr key={job.id}><td className="strong">{job.title}</td><td><div className="customer-cell"><span className="table-avatar">{viewerInitials(client)}</span><span className="strong">{client}</span></div></td><td>{job.address || "—"}</td><td className="strong">{estimate ? formatMoney(estimate.totalCents, estimate.currency) : "Not drafted"}</td><td><StatusBadge status={status} /></td><td>{job.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><JobDeleteButton jobId={job.id} jobTitle={job.title} /></td><td><Link aria-label={`Open ${job.title}`} href={destination} className="icon-button"><ChevronRight size={15} /></Link></td></tr>;
      })}</tbody></table></div> : <div className="empty-state"><HardHat size={23} /><h3>No jobs yet</h3><p>Create a proposal from your first site walk. The client and job will be saved to this workspace only.</p><Link href="/jobs/new" className="button button-primary button-sm">Create proposal</Link></div>}
    </section>
  </>;
}
