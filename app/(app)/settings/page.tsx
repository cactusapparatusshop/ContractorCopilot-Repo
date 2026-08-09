import { PageHeader } from "@/components/app-shell";
import { SettingsForm, type SettingsFormData } from "@/components/settings-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isTwoFactorConfigured } from "@/lib/two-factor";

function previewSettings(user: { id: string; name?: string | null; email: string }): SettingsFormData {
  return {
    account: { name: user.name ?? "Demo contractor", email: user.email },
    company: { name: "Demo Contractor Co.", email: user.email, phone: "", address: "", defaultDepositPercent: 30, defaultProposalValidityDays: 14, defaultWarrantyText: "", notificationsEnabled: true, role: "OWNER" },
    team: [{ id: user.id, name: user.name ?? null, email: user.email, role: "OWNER" }],
    security: { twoFactorEnabled: false, available: false },
    preview: true,
  };
}

export default async function SettingsPage() {
  const user = await requireUser();
  if (user.isDemo || !prisma || !user.companyId) {
    return <><PageHeader title="Settings" subtitle="Manage your company, proposal defaults, and team access." /><SettingsForm initial={previewSettings(user)} /></>;
  }
  const company = await prisma.company.findFirst({
    where: { id: user.companyId, memberships: { some: { userId: user.id } } },
    include: { memberships: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!company) {
    return <><PageHeader title="Settings" subtitle="Manage your company, proposal defaults, and team access." /><SettingsForm initial={previewSettings(user)} /></>;
  }
  const security = await prisma.user.findUnique({ where: { id: user.id }, select: { twoFactorEnabledAt: true } });
  const initial: SettingsFormData = {
    account: { name: user.name ?? "", email: user.email },
    company: {
      name: company.name,
      email: company.email ?? "",
      phone: company.phone ?? "",
      address: company.address ?? "",
      defaultDepositPercent: company.defaultDepositPercent,
      defaultProposalValidityDays: company.defaultProposalValidityDays,
      defaultWarrantyText: company.defaultWarrantyText ?? "",
      notificationsEnabled: company.notificationsEnabled,
      role: company.memberships.find((membership) => membership.userId === user.id)?.role ?? "VIEWER",
    },
    team: company.memberships.map((membership) => ({ id: membership.user.id, name: membership.user.name, email: membership.user.email, role: membership.role })),
    security: { twoFactorEnabled: Boolean(security?.twoFactorEnabledAt), available: isTwoFactorConfigured() },
  };
  return <><PageHeader title="Settings" subtitle="Manage your company, proposal defaults, and team access." /><SettingsForm initial={initial} /></>;
}
