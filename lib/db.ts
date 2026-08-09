import "server-only";

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var contractorCopilotPrisma: PrismaClient | undefined;
}

/** True only when a usable connection string was supplied to the server. */
export function isDatabaseConfigured() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  return Boolean(databaseUrl && !databaseUrl.startsWith("postgresql://example"));
}

/**
 * Deliberately remains null in demo mode. This keeps a fresh preview usable
 * before PostgreSQL and Prisma migrations have been configured.
 */
export const prisma: PrismaClient | null = isDatabaseConfigured()
  ? globalThis.contractorCopilotPrisma ?? new PrismaClient()
  : null;

if (process.env.NODE_ENV !== "production" && prisma) {
  globalThis.contractorCopilotPrisma = prisma;
}

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("A database connection has not been configured.");
    this.name = "DatabaseUnavailableError";
  }
}

export function requireDatabase(): PrismaClient {
  if (!prisma) throw new DatabaseUnavailableError();
  return prisma;
}

export async function checkDatabaseHealth(): Promise<"connected" | "unconfigured" | "unavailable"> {
  if (!prisma) return "unconfigured";

  try {
    await prisma.$queryRaw`SELECT 1`;
    return "connected";
  } catch {
    return "unavailable";
  }
}

/** Returns a company only when the signed-in user is a member of it. */
export async function getCompanyForUser(userId: string, companyId?: string) {
  const db = requireDatabase();

  return db.company.findFirst({
    where: {
      ...(companyId ? { id: companyId } : {}),
      memberships: { some: { userId } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      address: true,
      brandColor: true,
      currency: true,
      stripeCustomerId: true,
      freeDocumentCreationsUsed: true,
      taxRateBps: true,
      defaultMarkupBps: true,
      defaultDepositPercent: true,
      defaultProposalValidityDays: true,
      defaultWarrantyText: true,
      notificationsEnabled: true,
      memberships: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function userCanAccessJob(userId: string, jobId: string) {
  const db = requireDatabase();
  return db.job.findFirst({
    where: {
      id: jobId,
      company: { memberships: { some: { userId } } },
    },
    select: { id: true, companyId: true, title: true },
  });
}
