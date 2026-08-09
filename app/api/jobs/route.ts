import { NextResponse } from "next/server";

import { requireUser, isDemoMode } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";
import { takeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type CreateJobRequest = {
  customerName?: unknown;
  customerEmail?: unknown;
  jobType?: unknown;
  trade?: unknown;
  address?: unknown;
  notes?: unknown;
  materials?: unknown;
};

function splitName(fullName: string) {
  const [firstName, ...last] = fullName.trim().split(/\s+/);
  return { firstName: firstName || "Customer", lastName: last.join(" ") || null };
}

/** Creates the customer/job record that anchors photos, AI drafts, and proposals. */
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const body = await readJson<CreateJobRequest>(request);
    const customerName = stringField(body.customerName, "customerName", { max: 160 })!;
    const customerEmail = stringField(body.customerEmail, "customerEmail", { required: false, max: 180 })?.toLowerCase();
    const jobType = stringField(body.jobType, "jobType", { max: 200 })!;
    const address = stringField(body.address, "address", { required: false, max: 300 });
    const notes = stringField(body.notes, "notes", { required: false, max: 6_000 });
    const materials = stringField(body.materials, "materials", { required: false, max: 4_000 });
    const limiter = takeRateLimit(`jobs:${user.id}`, 30, 60_000);
    if (!limiter.allowed) throw new HttpError(429, "RATE_LIMITED", "Please wait a moment before creating another job.");

    if (!prisma) {
      if (!isDemoMode()) throw new HttpError(503, "DATABASE_UNAVAILABLE", "Connect PostgreSQL to create jobs.");
      return NextResponse.json({ id: "demo-job", customerId: "demo-customer", demo: true });
    }
    if (user.isDemo) return NextResponse.json({ id: "demo-job", customerId: "demo-customer", demo: true });

    const company = await getCompanyForUser(user.id, user.companyId);
    if (!company) throw new HttpError(403, "COMPANY_ACCESS_REQUIRED", "Select a company before creating a job.");
    const name = splitName(customerName);
    let customer = customerEmail
      ? await prisma.customer.findFirst({ where: { companyId: company.id, email: customerEmail }, select: { id: true } })
      : await prisma.customer.findFirst({ where: { companyId: company.id, firstName: name.firstName, lastName: name.lastName }, select: { id: true } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { companyId: company.id, ...name, email: customerEmail, address1: address },
        select: { id: true },
      });
    }
    const description = [notes ? `Site notes:\n${notes}` : null, materials ? `Materials:\n${materials}` : null].filter(Boolean).join("\n\n") || null;
    const job = await prisma.job.create({
      data: { companyId: company.id, customerId: customer.id, title: jobType, description, address, status: "DRAFT" },
      select: { id: true },
    });
    return NextResponse.json({ id: job.id, customerId: customer.id, demo: false }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
