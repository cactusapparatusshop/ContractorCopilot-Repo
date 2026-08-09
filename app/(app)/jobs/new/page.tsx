import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { EstimateWizard } from "@/components/estimate-wizard";
import { getCurrentUser } from "@/lib/auth";

export default async function NewJobPage() {
  const user = await getCurrentUser();
  return <><div className="page-header"><div><Link href="/jobs" className="text-link"><ChevronLeft size={14} style={{ verticalAlign: "-2px" }} /> Back to jobs</Link><h1 style={{ marginTop: 13 }}>Create a proposal</h1><p>Turn the walkthrough into an itemized, customer-ready proposal and PDF.</p></div></div><EstimateWizard demo={user?.isDemo === true} /></>;
}
