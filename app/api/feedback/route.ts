import { NextResponse } from "next/server";
import type { FeedbackKind, FeedbackStatus } from "@prisma/client";

import { isPlatformAdmin, requireUser } from "@/lib/auth";
import { getCompanyForUser, prisma } from "@/lib/db";
import { errorResponse, HttpError, readJson, requireSameOrigin, stringField } from "@/lib/http";

export const runtime = "nodejs";

const kinds = new Set(["BUG", "FEATURE"]);
const statuses = new Set(["NEW", "REVIEWING", "PLANNED", "RESOLVED", "CLOSED"]);

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    if (user.isDemo || !prisma) throw new HttpError(503, "FEEDBACK_UNAVAILABLE", "Feedback is available after your workspace database is connected.");
    const body = await readJson<{ kind?: unknown; title?: unknown; details?: unknown; pageUrl?: unknown }>(request);
    if (typeof body.kind !== "string" || !kinds.has(body.kind)) throw new HttpError(400, "INVALID_REQUEST", "Choose bug report or feature request.");
    const company = await getCompanyForUser(user.id, user.companyId);
    if (!company) throw new HttpError(403, "WORKSPACE_NOT_FOUND", "A workspace is required to submit feedback.");
    const pageUrl = stringField(body.pageUrl, "pageUrl", { required: false, max: 1000 });
    if (pageUrl) {
      try { new URL(pageUrl); } catch { throw new HttpError(400, "INVALID_REQUEST", "pageUrl must be a valid URL."); }
    }
    const feedback = await prisma.feedbackSubmission.create({
      data: { companyId: company.id, submittedById: user.id, kind: body.kind as FeedbackKind, title: stringField(body.title, "title", { max: 160 })!, details: stringField(body.details, "details", { max: 4000 })!, pageUrl },
      select: { id: true, status: true, createdAt: true },
    });
    await prisma.auditLog.create({ data: { companyId: company.id, actorId: user.id, action: "FEEDBACK_SUBMITTED", entity: "FeedbackSubmission", entityId: feedback.id, metadata: { kind: feedback.status } } });
    return NextResponse.json({ feedback, message: "Feedback submitted for review." }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    if (!prisma || !(await isPlatformAdmin(user))) throw new HttpError(403, "FORBIDDEN", "Platform administrator access is required.");
    const body = await readJson<{ id?: unknown; status?: unknown; adminNotes?: unknown }>(request);
    const id = stringField(body.id, "id", { max: 80 })!;
    if (typeof body.status !== "string" || !statuses.has(body.status)) throw new HttpError(400, "INVALID_REQUEST", "Choose a valid review status.");
    const adminNotes = stringField(body.adminNotes, "adminNotes", { required: false, max: 4000 });
    const updated = await prisma.feedbackSubmission.update({ where: { id }, data: { status: body.status as FeedbackStatus, adminNotes }, select: { id: true, status: true, adminNotes: true, updatedAt: true, companyId: true } });
    await prisma.auditLog.create({ data: { companyId: updated.companyId, actorId: user.id, action: "FEEDBACK_REVIEWED", entity: "FeedbackSubmission", entityId: updated.id, metadata: { status: updated.status } } });
    return NextResponse.json({ feedback: updated });
  } catch (error) { return errorResponse(error); }
}
