import { NextResponse } from "next/server";

import { hasAtLeastRole, isPlatformAdmin, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { errorResponse, HttpError, requireSameOrigin } from "@/lib/http";

export const runtime = "nodejs";

/** Deletes one workspace job and the proposal records that only belong to it. */
export async function DELETE(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { jobId } = await context.params;
    if (!jobId || jobId.length > 80) throw new HttpError(400, "INVALID_REQUEST", "The job ID is invalid.");
    if (user.isDemo || !prisma) throw new HttpError(503, "JOBS_UNAVAILABLE", "Jobs can’t be deleted in the preview workspace.");
    if (!(await isPlatformAdmin(user)) && !hasAtLeastRole(user, "ADMIN")) {
      throw new HttpError(403, "FORBIDDEN", "Only workspace owners and administrators can delete jobs.");
    }

    const job = await prisma.job.findFirst({ where: { id: jobId, company: { memberships: { some: { userId: user.id } } } }, select: { id: true, companyId: true, title: true } });
    if (!job) throw new HttpError(404, "JOB_NOT_FOUND", "That job was not found in your workspace.");

    await prisma.$transaction(async (db) => {
      const estimates = await db.estimate.findMany({ where: { jobId: job.id }, select: { id: true } });
      const estimateIds = estimates.map((estimate) => estimate.id);
      if (estimateIds.length) await db.asset.deleteMany({ where: { estimateId: { in: estimateIds } } });
      await db.asset.deleteMany({ where: { jobId: job.id } });
      await db.estimate.deleteMany({ where: { jobId: job.id } });
      await db.job.delete({ where: { id: job.id } });
      await db.auditLog.create({ data: { companyId: job.companyId, actorId: user.id, action: "JOB_DELETED", entity: "Job", entityId: job.id, metadata: { title: job.title, deletedEstimateCount: estimateIds.length } } });
    });
    return NextResponse.json({ message: "Job deleted." });
  } catch (error) {
    return errorResponse(error);
  }
}
