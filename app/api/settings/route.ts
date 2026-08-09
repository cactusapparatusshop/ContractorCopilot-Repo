import { NextResponse } from "next/server";

import { createSessionToken, hasAtLeastRole, requireUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { errorResponse, HttpError, integerField, privateNoStoreHeaders, readJson, requireSameOrigin, stringField } from "@/lib/http";

export const runtime = "nodejs";

type SettingsRequest = {
  section?: unknown;
  name?: unknown;
  companyName?: unknown;
  companyEmail?: unknown;
  companyPhone?: unknown;
  companyAddress?: unknown;
  defaultDepositPercent?: unknown;
  defaultProposalValidityDays?: unknown;
  defaultWarrantyText?: unknown;
  notificationsEnabled?: unknown;
};

async function currentCompany() {
  const user = await requireUser();
  if (user.isDemo || !prisma) throw new HttpError(503, "SETTINGS_UNAVAILABLE", "Settings are unavailable in the preview workspace.");
  const company = await getCompanyForUser(user.id, user.companyId);
  if (!company) throw new HttpError(403, "COMPANY_ACCESS_REQUIRED", "You do not have access to this workspace.");
  const role = company.memberships[0]?.role;
  if (!role || !hasAtLeastRole({ ...user, role }, "ADMIN")) {
    throw new HttpError(403, "SETTINGS_ACCESS_REQUIRED", "Only a workspace owner or administrator can change these settings.");
  }
  return { user, company };
}

function settingsPayload(user: { name?: string | null; email: string }, company: {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  defaultDepositPercent: number;
  defaultProposalValidityDays: number;
  defaultWarrantyText: string | null;
  notificationsEnabled: boolean;
  memberships: { role: string }[];
}) {
  return {
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
      role: company.memberships[0]?.role ?? "VIEWER",
    },
  };
}

export async function GET() {
  try {
    const { user, company } = await currentCompany();
    return NextResponse.json(settingsPayload(user, company), { headers: privateNoStoreHeaders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const { user, company } = await currentCompany();
    const body = await readJson<SettingsRequest>(request);
    const section = stringField(body.section, "section", { max: 32 });
    let updatedUser = user;

    if (section === "account") {
      const name = stringField(body.name, "name", { max: 120 });
      updatedUser = await prisma!.user.update({ where: { id: user.id }, data: { name }, select: { id: true, email: true, name: true } });
    } else if (section === "company") {
      await prisma!.company.update({
        where: { id: company.id },
        data: {
          name: stringField(body.companyName, "companyName", { max: 120 }),
          email: stringField(body.companyEmail, "companyEmail", { required: false, max: 180 }) ?? null,
          phone: stringField(body.companyPhone, "companyPhone", { required: false, max: 60 }) ?? null,
          address: stringField(body.companyAddress, "companyAddress", { required: false, max: 240 }) ?? null,
        },
      });
    } else if (section === "proposal") {
      await prisma!.company.update({
        where: { id: company.id },
        data: {
          defaultDepositPercent: integerField(body.defaultDepositPercent, "defaultDepositPercent", { min: 0, max: 100 }),
          defaultProposalValidityDays: integerField(body.defaultProposalValidityDays, "defaultProposalValidityDays", { min: 1, max: 365 }),
          defaultWarrantyText: stringField(body.defaultWarrantyText, "defaultWarrantyText", { required: false, max: 4_000 }) ?? null,
        },
      });
    } else if (section === "notifications") {
      if (typeof body.notificationsEnabled !== "boolean") {
        throw new HttpError(400, "INVALID_REQUEST", "notificationsEnabled must be true or false.");
      }
      await prisma!.company.update({ where: { id: company.id }, data: { notificationsEnabled: body.notificationsEnabled } });
    } else {
      throw new HttpError(400, "INVALID_REQUEST", "Choose a valid settings section.");
    }

    const refreshed = await getCompanyForUser(user.id, company.id);
    if (!refreshed) throw new HttpError(404, "WORKSPACE_NOT_FOUND", "This workspace no longer exists.");
    const response = NextResponse.json(settingsPayload(updatedUser, refreshed), { headers: privateNoStoreHeaders });
    if (section === "account") {
      response.cookies.set(SESSION_COOKIE, createSessionToken({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        companyId: refreshed.id,
        role: refreshed.memberships[0]?.role,
        isDemo: false,
        sessionVersion: (await prisma!.user.findUniqueOrThrow({ where: { id: updatedUser.id }, select: { sessionVersion: true } })).sessionVersion,
      }), sessionCookieOptions);
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
