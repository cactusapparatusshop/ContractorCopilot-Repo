import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function required(name: "BOOTSTRAP_ADMIN_EMAIL" | "BOOTSTRAP_ADMIN_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set before running db:bootstrap-admin.`);
  return value;
}

function optional(name: "BOOTSTRAP_ADMIN_NAME" | "BOOTSTRAP_COMPANY_NAME", fallback: string) {
  return process.env[name]?.trim() || fallback;
}

function validEmail(email: string) {
  return /^\S+@\S+\.\S+$/.test(email);
}

function slugRoot(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 38) || "contractorcopilot"
  );
}

/**
 * Creates the first live platform operator without relying on the development
 * seed account. Existing email addresses are deliberately left untouched, so
 * this command is safe to repeat and cannot reset a password or roles.
 */
async function main() {
  const email = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = required("BOOTSTRAP_ADMIN_PASSWORD");
  if (!validEmail(email)) throw new Error("BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
  if (password.length < 12) throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.");

  const name = optional("BOOTSTRAP_ADMIN_NAME", "Platform Administrator");
  const companyName = optional("BOOTSTRAP_COMPANY_NAME", "ContractorCopilot");

  const result = await prisma.$transaction(async (db) => {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { created: false as const };

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: { email, name, passwordHash, isAdmin: true },
      select: { id: true },
    });
    const company = await db.company.create({
      data: {
        name: companyName,
        email,
        slug: `${slugRoot(companyName)}-admin-${randomUUID().slice(0, 8)}`,
      },
      select: { id: true },
    });
    await db.membership.create({ data: { userId: user.id, companyId: company.id, role: "OWNER" } });
    return { created: true as const };
  });

  console.log(result.created ? `Created the live platform administrator for ${email}.` : `No change: ${email} already exists.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
