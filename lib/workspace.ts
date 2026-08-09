import "server-only";

import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";

export type WorkspaceViewer = {
  user: AuthUser;
  company: NonNullable<Awaited<ReturnType<typeof getCompanyForUser>>> | null;
};

/** Resolves the signed-in user's active company through its membership. */
export async function getWorkspaceViewer(): Promise<WorkspaceViewer> {
  const user = await getCurrentUser();
  if (!user) throw new Error("A signed-in user is required to load a workspace.");
  const company = user.isDemo || !prisma ? null : await getCompanyForUser(user.id, user.companyId);
  return { user, company };
}

export function viewerInitials(name?: string | null, email?: string | null) {
  const words = (name || email || "CC").trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "CC";
}

export function firstName(name?: string | null, email?: string | null) {
  return name?.trim().split(/\s+/)[0] || email?.split("@")[0] || "there";
}
