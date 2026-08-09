import { AppShell } from "@/components/app-shell";
import { getCurrentUser, isPlatformAdmin } from "@/lib/auth";
import { getCompanyForUser } from "@/lib/db";
import { viewerInitials } from "@/lib/workspace";
import { redirect } from "next/navigation";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const company = user.isDemo ? null : await getCompanyForUser(user.id, user.companyId);
  const platformAdmin = await isPlatformAdmin(user);
  return <AppShell viewer={{ name: user.name, email: user.email, initials: viewerInitials(user.name, user.email), isPlatformAdmin: platformAdmin }} company={company ? { name: company.name, notificationsEnabled: company.notificationsEnabled } : null}>{children}</AppShell>;
}
