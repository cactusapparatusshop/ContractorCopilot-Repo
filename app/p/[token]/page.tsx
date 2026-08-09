import Link from "next/link";
import { Download, MessageCircle } from "lucide-react";
import { MiniProductMark } from "@/components/app-shell";
import { PortalActions } from "@/components/portal-actions";
import { ProposalDocument, proposalDocumentFromPublic } from "@/components/proposal-document";
import { publicProposalDataForToken } from "@/lib/proposals";
import { currency } from "@/lib/format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await publicProposalDataForToken(token);
  if (!proposal) notFound();
  const document = proposalDocumentFromPublic(proposal);

  return <main className="portal-page"><nav className="portal-nav"><Link href="/" className="brand"><span className="brand-mark">C</span>ContractorCopilot</Link><div style={{ display: "flex", gap: 8 }}><a className="button button-ghost button-sm" href={`mailto:${proposal.company.email ?? ""}`}><MessageCircle size={14} /> Ask a question</a><a className="button button-outline button-sm" href={`/api/portal/${encodeURIComponent(token)}/pdf`} target="_blank"><Download size={14} /> Download PDF</a></div></nav><section className="portal-shell"><ProposalDocument portal data={document} /><aside className="portal-summary"><MiniProductMark /><div style={{ marginTop: 24 }}><h2>Ready when you are</h2><p>Review the proposal, approve it securely, and pay your deposit to reserve your spot on the schedule.</p></div><div className="portal-price"><small>Total project investment</small><strong>{currency(document.total, 2)}</strong><small style={{ marginTop: 11 }}>Deposit to schedule ({document.depositPercent}%)</small><b style={{ display: "block", marginTop: 3, fontSize: 16 }}>{currency(document.deposit, 2)}</b></div><PortalActions token={token} customerName={proposal.customer.name} customerEmail={proposal.customer.email} depositAmount={document.deposit} /><p style={{ marginTop: 17, color: "#a9bec1", fontSize: 9, lineHeight: 1.5 }}>By approving, you agree to the scope, terms, and warranty shown in this proposal. Valid through {proposal.validUntil ?? "the stated expiration date"}.</p></aside></section></main>;
}
