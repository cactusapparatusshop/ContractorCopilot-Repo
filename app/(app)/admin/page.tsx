import { Building2, CircleDollarSign, FileText, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import { FeedbackReviewList } from "@/components/feedback-review-list";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/pricing";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!(await isPlatformAdmin(user))) redirect("/dashboard");

  const [companyCount, memberCount, proposalCount, paidDeposits, companies, feedback] = user.isDemo || !prisma
    ? [0, 0, 0, { _sum: { amountCents: null } }, [], []] as const
    : await Promise.all([
      prisma.company.count(),
      prisma.membership.count(),
      prisma.proposal.count(),
      prisma.payment.aggregate({ where: { status: "PAID", currency: "usd" }, _sum: { amountCents: true } }),
      prisma.company.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          memberships: { where: { role: "OWNER" }, take: 1, include: { user: { select: { name: true, email: true } } } },
          subscription: { select: { plan: true, status: true } },
          _count: { select: { jobs: true, proposals: true } },
        },
      }),
      prisma.feedbackSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { company: { select: { name: true } }, submittedBy: { select: { email: true, name: true } } } }),
    ]);

  const stats = [
    { label: "Workspace companies", value: companyCount.toLocaleString("en-US"), detail: "All companies in the platform", icon: Building2 },
    { label: "Workspace members", value: memberCount.toLocaleString("en-US"), detail: "All contractor user accounts", icon: UsersRound },
    { label: "Proposals created", value: proposalCount.toLocaleString("en-US"), detail: "All saved proposals", icon: FileText },
    { label: "USD deposits processed", value: formatMoney(paidDeposits._sum.amountCents ?? 0, "usd"), detail: "Paid USD deposits recorded in the platform", icon: CircleDollarSign },
  ];

  return <>
    <PageHeader title="Platform admin" subtitle="Live data from ContractorCopilot workspaces, proposals, and payments." />
    <section className="admin-grid">{stats.map((stat) => {
      const Icon = stat.icon;
      return <article className="card admin-card" key={stat.label}><span className="icon-box blue" style={{ float: "right" }}><Icon /></span><small>{stat.label}</small><strong>{stat.value}</strong><span>{stat.detail}</span></article>;
    })}</section>
    <section className="card" style={{ overflow: "hidden", marginTop: 16 }}>
      <div className="card-heading"><div><h2>Companies</h2><p>Actual contractor workspaces, newest first.</p></div></div>
      {companies.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Company</th><th>Owner</th><th>Plan</th><th>Jobs</th><th>Proposals</th><th>Joined</th></tr></thead><tbody>{companies.map((company) => {
        const owner = company.memberships[0]?.user;
        const plan = company.subscription?.plan === "PRO" && ["ACTIVE", "TRIALING"].includes(company.subscription.status) ? "Pro" : "Free";
        return <tr key={company.id}><td className="strong">{company.name}</td><td>{owner?.name || owner?.email || "Not assigned"}</td><td><span className="status viewed">{plan}</span></td><td>{company._count.jobs}</td><td>{company._count.proposals}</td><td>{company.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td></tr>;
      })}</tbody></table></div> : <div className="feedback-review-empty">No real company data is available yet.</div>}
    </section>
    <section className="card feedback-review-card"><div className="card-heading"><div><h2>Feedback review</h2><p>New bug reports and feature requests from contractor workspaces.</p></div></div><FeedbackReviewList initialFeedback={feedback.map((item) => ({ id: item.id, kind: item.kind, status: item.status, title: item.title, details: item.details, pageUrl: item.pageUrl, adminNotes: item.adminNotes, createdAt: item.createdAt.toISOString(), company: item.company.name, submittedBy: item.submittedBy.name || item.submittedBy.email }))} /></section>
  </>;
}
