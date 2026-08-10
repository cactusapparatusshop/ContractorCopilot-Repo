import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { errorResponse, HttpError } from "@/lib/http";

export const runtime = "nodejs";

type SearchResult = { id: string; type: "JOB" | "PROPOSAL" | "CUSTOMER"; title: string; detail?: string; href: string };

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    if (user.isDemo || !prisma) return NextResponse.json({ results: [] satisfies SearchResult[] });
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return NextResponse.json({ results: [] satisfies SearchResult[] });
    if (query.length > 100) throw new HttpError(400, "INVALID_REQUEST", "Search must be 100 characters or fewer.");
    const company = await getCompanyForUser(user.id, user.companyId);
    if (!company) throw new HttpError(403, "WORKSPACE_NOT_FOUND", "A workspace is required to search.");
    const text = { contains: query, mode: "insensitive" as const };
    const customerMatch = { OR: [{ firstName: text }, { lastName: text }, { email: text }, { phone: text }, { address1: text }, { city: text }, { state: text }] };
    const [jobs, estimates, customers] = await Promise.all([
      prisma.job.findMany({ where: { companyId: company.id, OR: [{ id: query }, { title: text }, { description: text }, { address: text }, { customer: { is: customerMatch } }] }, include: { customer: true, estimates: { select: { id: true }, orderBy: { updatedAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 6 }),
      prisma.estimate.findMany({ where: { companyId: company.id, OR: [{ id: query }, { title: text }, { scopeOfWork: text }, { job: { is: { title: text } } }, { job: { is: { customer: { is: customerMatch } } } }] }, include: { job: { include: { customer: true } } }, orderBy: { updatedAt: "desc" }, take: 6 }),
      prisma.customer.findMany({ where: { companyId: company.id, OR: [{ id: query }, ...customerMatch.OR] }, orderBy: { updatedAt: "desc" }, take: 6 }),
    ]);
    const results: SearchResult[] = [
      ...jobs.map((job) => ({ id: job.id, type: "JOB" as const, title: job.title, detail: [job.customer.firstName, job.customer.lastName].filter(Boolean).join(" ") || job.address || undefined, href: job.estimates[0] ? `/estimates/${job.estimates[0].id}` : `/jobs?search=${encodeURIComponent(job.id)}` })),
      ...estimates.map((estimate) => ({ id: estimate.id, type: "PROPOSAL" as const, title: `Proposal #${estimate.number}`, detail: estimate.job?.title ?? estimate.title, href: `/estimates/${estimate.id}` })),
      ...customers.map((customer) => ({ id: customer.id, type: "CUSTOMER" as const, title: [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Customer", detail: customer.email || customer.phone || [customer.city, customer.state].filter(Boolean).join(", ") || undefined, href: `/customers?search=${encodeURIComponent(customer.id)}` })),
    ];
    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error);
  }
}
