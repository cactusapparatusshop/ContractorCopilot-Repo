import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  const company = await prisma.company.upsert({
    where: { slug: "northstar-fencing" },
    update: { name: "Northstar Fencing Co.", email: "marcus@northstarfencing.com", phone: "(512) 555-0194", address: "4012 South Lamar Blvd, Austin, TX 78704", taxRateBps: 0, defaultMarkupBps: 2500 },
    create: { name: "Northstar Fencing Co.", slug: "northstar-fencing", email: "marcus@northstarfencing.com", phone: "(512) 555-0194", address: "4012 South Lamar Blvd, Austin, TX 78704", taxRateBps: 0, defaultMarkupBps: 2500 },
  });
  const user = await prisma.user.upsert({
    where: { email: "marcus@northstarfencing.com" },
    update: { name: "Marcus Lee", passwordHash, isAdmin: true },
    create: { email: "marcus@northstarfencing.com", name: "Marcus Lee", passwordHash, isAdmin: true },
  });
  await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { role: "OWNER" },
    create: { userId: user.id, companyId: company.id, role: "OWNER" },
  });

  let customer = await prisma.customer.findFirst({ where: { companyId: company.id, email: "olivia.martinez@email.com" } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { companyId: company.id, firstName: "Olivia", lastName: "Martinez", email: "olivia.martinez@email.com", phone: "(512) 555-0127", address1: "1809 Bluebonnet Lane", city: "Austin", state: "TX", postalCode: "78704" },
    });
  }
  let job = await prisma.job.findFirst({ where: { companyId: company.id, customerId: customer.id, title: "Cedar privacy fence installation" } });
  if (!job) {
    job = await prisma.job.create({
      data: { companyId: company.id, customerId: customer.id, title: "Cedar privacy fence installation", description: "Remove existing chain-link fence and install 120 LF cedar privacy fence with one gate.", address: "1809 Bluebonnet Lane, Austin, TX 78704", status: "DRAFT" },
    });
  }

  const estimate = await prisma.estimate.upsert({
    where: { companyId_number: { companyId: company.id, number: 1048 } },
    update: { jobId: job.id, createdById: user.id, title: "Cedar privacy fence installation", scopeOfWork: "Remove and dispose of the existing chain-link fence, then install 120 linear feet of 6-foot western red cedar privacy fencing with one 4-foot walk gate. Work includes concrete-set posts, exterior-rated fasteners, site cleanup, and a final walkthrough.", assumptions: "Ground is mostly level.\nAccess is available through the side gate.", exclusions: "Permits, engineering, and concealed conditions unless specifically listed.", status: "READY", materialSubtotalCents: 439573, laborSubtotalCents: 72000, markupCents: 0, taxCents: 58527, totalCents: 638100, validUntil: new Date("2026-08-14T23:59:59.000Z") },
    create: { companyId: company.id, jobId: job.id, createdById: user.id, number: 1048, title: "Cedar privacy fence installation", scopeOfWork: "Remove and dispose of the existing chain-link fence, then install 120 linear feet of 6-foot western red cedar privacy fencing with one 4-foot walk gate. Work includes concrete-set posts, exterior-rated fasteners, site cleanup, and a final walkthrough.", assumptions: "Ground is mostly level.\nAccess is available through the side gate.", exclusions: "Permits, engineering, and concealed conditions unless specifically listed.", status: "READY", materialSubtotalCents: 439573, laborSubtotalCents: 72000, markupCents: 0, taxCents: 58527, totalCents: 638100, validUntil: new Date("2026-08-14T23:59:59.000Z") },
  });
  await prisma.estimateItem.deleteMany({ where: { estimateId: estimate.id } });
  await prisma.estimateItem.createMany({
    data: [
      { estimateId: estimate.id, category: "LABOR", description: "Remove existing chain-link fence", quantity: 120, unit: "LF", unitCostCents: 600, unitPriceCents: 600, sortOrder: 0 },
      { estimateId: estimate.id, category: "MATERIAL", description: "6-foot cedar privacy fence", quantity: 120, unit: "LF", unitCostCents: 3250, unitPriceCents: 3250, taxable: true, sortOrder: 1 },
      { estimateId: estimate.id, category: "MATERIAL", description: "4-foot cedar walk gate", quantity: 1, unit: "EA", unitCostCents: 68000, unitPriceCents: 68000, taxable: true, sortOrder: 2 },
      { estimateId: estimate.id, category: "MATERIAL", description: "Post concrete, hardware & cleanup", quantity: 1, unit: "LOT", unitCostCents: 49573, unitPriceCents: 49573, taxable: true, sortOrder: 3 },
    ],
  });
  const proposal = await prisma.proposal.upsert({
    where: { estimateId: estimate.id },
    update: { status: "SENT", publicToken: "demo-proposal", depositAmountCents: 191430, sentAt: new Date("2026-07-31T14:35:00.000Z"), expiresAt: new Date("2026-08-14T23:59:59.000Z"), terms: "A 30% deposit reserves the installation date. The remaining balance is due at completion unless otherwise agreed in writing." },
    create: { companyId: company.id, estimateId: estimate.id, publicToken: "demo-proposal", status: "SENT", depositAmountCents: 191430, sentAt: new Date("2026-07-31T14:35:00.000Z"), expiresAt: new Date("2026-08-14T23:59:59.000Z"), terms: "A 30% deposit reserves the installation date. The remaining balance is due at completion unless otherwise agreed in writing." },
  });
  await prisma.documentCreation.upsert({
    where: { companyId_kind_sourceId: { companyId: company.id, kind: "PROPOSAL", sourceId: proposal.id } },
    update: { consumedFreeCreation: true },
    create: { companyId: company.id, kind: "PROPOSAL", sourceId: proposal.id, createdById: user.id, consumedFreeCreation: true },
  });
  const freeDocumentCreationsUsed = Math.min(
    3,
    await prisma.documentCreation.count({ where: { companyId: company.id, consumedFreeCreation: true } }),
  );
  await prisma.company.update({ where: { id: company.id }, data: { freeDocumentCreationsUsed } });
  await prisma.subscription.upsert({
    where: { companyId: company.id },
    update: { plan: "FREE", status: "CANCELED", currentPeriodEnd: null, cancelAtPeriodEnd: false },
    create: { companyId: company.id, plan: "FREE", status: "CANCELED" },
  });
  console.log("Seeded Northstar Fencing Co. (sign in: marcus@northstarfencing.com / ChangeMe123!)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
