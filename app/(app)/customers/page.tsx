import Link from "next/link";
import { Mail, MapPin, Phone, Plus, Users } from "lucide-react";

import { PageHeader } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";
import { viewerInitials } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await requireUser();
  const company = user.isDemo || !prisma ? null : await getCompanyForUser(user.id, user.companyId);
  const customers = company ? await prisma!.customer.findMany({
    where: { companyId: company.id },
    include: { jobs: { include: { estimates: { select: { id: true, totalCents: true, status: true }, orderBy: { updatedAt: "desc" } } }, orderBy: { updatedAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
  }) : [];
  const primary = customers[0];
  return <>
    <PageHeader title="Customers" subtitle="Build better relationships, from first walkthrough to final payment."><Link href="/jobs/new" className="button button-primary"><Plus size={15} /> Add customer with proposal</Link></PageHeader>
    <section className="customer-grid">
      <article className="card" style={{ overflow: "hidden" }}>
        {customers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Customer</th><th>Contact</th><th>Jobs</th><th>Proposal value</th><th>Stage</th></tr></thead><tbody>{customers.map((customer) => {
          const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
          const total = customer.jobs.flatMap((job) => job.estimates).reduce((sum, estimate) => sum + estimate.totalCents, 0);
          const stage = customer.jobs.some((job) => job.estimates.some((estimate) => estimate.status === "ACCEPTED")) ? "Active" : customer.jobs.some((job) => job.estimates.length) ? "Proposal" : "Lead";
          const address = [customer.address1, customer.city, customer.state].filter(Boolean).join(", ");
          return <tr key={customer.id}><td><div className="customer-cell"><span className="table-avatar">{viewerInitials(name)}</span><span><span className="strong" style={{ display: "block" }}>{name}</span><small style={{ color: "var(--ink-faint)", fontSize: 10 }}>{address || "No address yet"}</small></span></div></td><td><span className="strong" style={{ display: "block" }}>{customer.email || "No email yet"}</span><small style={{ color: "var(--ink-faint)", fontSize: 10 }}>{customer.phone || ""}</small></td><td className="strong">{customer.jobs.length}</td><td className="strong">{formatMoney(total, company?.currency ?? "usd")}</td><td><span className={`status ${stage === "Active" ? "accepted" : stage === "Proposal" ? "viewed" : "draft"}`}>{stage}</span></td></tr>;
        })}</tbody></table></div> : <div className="empty-state"><Users size={24} /><h3>No customers yet</h3><p>Your clients are created privately when you generate their first proposal.</p><Link href="/jobs/new" className="button button-primary button-sm">Create proposal</Link></div>}
      </article>
      <aside className="card customer-detail">
        {primary ? <><div className="customer-profile"><span className="table-avatar">{viewerInitials([primary.firstName, primary.lastName].filter(Boolean).join(" "))}</span><div><h2>{[primary.firstName, primary.lastName].filter(Boolean).join(" ")}</h2><p>Client in {company?.name ?? "this workspace"}</p></div></div><div style={{ display: "flex", gap: 7, marginTop: 18 }}><a className="icon-button" aria-label="Email customer" href={primary.email ? `mailto:${primary.email}` : undefined}><Mail /></a><a className="icon-button" aria-label="Call customer" href={primary.phone ? `tel:${primary.phone}` : undefined}><Phone /></a></div><dl><dt>Email</dt><dd>{primary.email || "Not provided"}</dd><dt>Phone</dt><dd>{primary.phone || "Not provided"}</dd><dt>Address</dt><dd><MapPin size={12} style={{ verticalAlign: "-2px", marginRight: 3 }} />{[primary.address1, primary.address2, [primary.city, primary.state, primary.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "Not provided"}</dd></dl><div className="customer-stats"><div className="customer-stat"><span>Projects</span><b>{primary.jobs.length}</b></div><div className="customer-stat"><span>Proposal value</span><b>{formatMoney(primary.jobs.flatMap((job) => job.estimates).reduce((sum, estimate) => sum + estimate.totalCents, 0), company?.currency ?? "usd")}</b></div></div></> : <div className="empty-state compact"><Users size={22} /><h3>Customer details</h3><p>A client profile appears here after you create the first proposal.</p></div>}
      </aside>
    </section>
  </>;
}
