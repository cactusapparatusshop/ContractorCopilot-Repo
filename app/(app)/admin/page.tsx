import { BarChart3, Building2, CircleDollarSign, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import { adminCompanies } from "@/lib/demo-data";
import { StatusBadge } from "@/components/status-badge";
import { FeedbackReviewList } from "@/components/feedback-review-list";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

const stats = [
  { label: "Monthly recurring revenue", value: "$7,098", detail: "+14.2% month over month", icon: CircleDollarSign },
  { label: "Active companies", value: "142", detail: "+19 this month", icon: Building2 },
  { label: "Active contractors", value: "381", detail: "+8.7% month over month", icon: UsersRound },
];

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!(await isPlatformAdmin(user))) redirect("/dashboard");
  const feedback = user.isDemo || !prisma ? [] : await prisma.feedbackSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { company: { select: { name: true } }, submittedBy: { select: { email: true, name: true } } } });
  return <><PageHeader title="Platform admin" subtitle="A high-level view of ContractorCopilot operations."><button className="button button-outline"><BarChart3 size={14} /> Export report</button></PageHeader><section className="admin-grid">{stats.map((stat) => { const Icon = stat.icon; return <article className="card admin-card" key={stat.label}><span className="icon-box blue" style={{ float: "right" }}><Icon /></span><small>{stat.label}</small><strong>{stat.value}</strong><span>{stat.detail}</span></article>; })}</section>
    <section className="dashboard-grid"><article className="card chart-card"><div className="card-heading"><div><h2>Gross payment volume</h2><p>Customer deposits processed through connected accounts.</p></div><span className="status accepted">Live</span></div><div className="chart-summary"><b>$74,392</b><span>↗ 22.4% vs. previous period</span></div><div className="big-chart"><svg viewBox="0 0 670 171" preserveAspectRatio="none"><defs><linearGradient id="admin-fade" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#17776d" stopOpacity=".18"/><stop offset="1" stopColor="#17776d" stopOpacity="0"/></linearGradient></defs><path d="M0 137 C40 130 54 134 82 107 S139 115 168 99 S209 112 242 80 S285 87 316 75 S348 90 382 60 S422 69 456 44 S498 64 534 30 S580 40 616 18 S642 24 670 10 L670 171 L0 171Z" fill="url(#admin-fade)"/><path d="M0 137 C40 130 54 134 82 107 S139 115 168 99 S209 112 242 80 S285 87 316 75 S348 90 382 60 S422 69 456 44 S498 64 534 30 S580 40 616 18 S642 24 670 10" fill="none" stroke="#17776d" strokeWidth="3"/></svg></div><div className="chart-months"><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span></div></article>
      <article className="card"><div className="card-heading"><div><h2>System health</h2><p>Current production services.</p></div></div><div className="activity-list"><div className="activity"><span className="activity-icon teal"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--teal)" }} /></span><div><b>API &amp; application</b><p>Operational · 99.99% uptime</p></div></div><div className="activity"><span className="activity-icon teal"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--teal)" }} /></span><div><b>Stripe webhooks</b><p>Operational · Last event 2 min ago</p></div></div><div className="activity"><span className="activity-icon teal"><span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--teal)" }} /></span><div><b>AI estimate worker</b><p>Operational · Median run 8.4 sec</p></div></div></div></article></section>
    <section className="card" style={{ overflow: "hidden", marginTop: 16 }}><div className="card-heading"><div><h2>Companies</h2><p>Newest and most active contractor accounts.</p></div><button className="button button-outline button-sm">View all companies</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Company</th><th>Owner</th><th>Plan</th><th>Account</th><th>MRR</th><th>AI jobs</th><th>Joined</th></tr></thead><tbody>{adminCompanies.map((company) => <tr key={company.name}><td className="strong">{company.name}</td><td>{company.owner}</td><td><span className="status viewed">{company.plan}</span></td><td><StatusBadge status={company.status as "Active" | "Trial"} /></td><td className="strong">{company.mrr}</td><td>{company.jobs}</td><td>{company.joined}</td></tr>)}</tbody></table></div></section>
    <section className="card feedback-review-card"><div className="card-heading"><div><h2>Feedback review</h2><p>New bug reports and feature requests from contractor workspaces.</p></div></div><FeedbackReviewList initialFeedback={feedback.map((item) => ({ id: item.id, kind: item.kind, status: item.status, title: item.title, details: item.details, pageUrl: item.pageUrl, adminNotes: item.adminNotes, createdAt: item.createdAt.toISOString(), company: item.company.name, submittedBy: item.submittedBy.name || item.submittedBy.email }))} /></section>
  </>;
}
