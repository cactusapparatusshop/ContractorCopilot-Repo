import { NextResponse } from "next/server";

import { captionJobsitePhoto, imageDataUrl, isJobsiteImage } from "@/lib/jobsite-photos";
import { requireUser } from "@/lib/auth";
import { prisma, userCanAccessJob } from "@/lib/db";
import { errorResponse, HttpError, requireSameOrigin } from "@/lib/http";

export const runtime = "nodejs";

const MAX_BYTES = 1_500_000;

export async function POST(request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    requireSameOrigin(request);
    const user = await requireUser();
    const { jobId } = await context.params;
    if (user.isDemo || !prisma) throw new HttpError(503, "PHOTOS_UNAVAILABLE", "Jobsite photos require a connected workspace database.");
    const job = await userCanAccessJob(user.id, jobId);
    if (!job) throw new HttpError(404, "JOB_NOT_FOUND", "That job was not found in your workspace.");
    const form = await request.formData();
    const files = form.getAll("photos").filter((value): value is File => value instanceof File).slice(0, 4);
    if (!files.length) throw new HttpError(400, "INVALID_REQUEST", "Choose at least one jobsite photo.");
    const photos = [];
    for (const file of files) {
      if (!isJobsiteImage(file.type) || file.size > MAX_BYTES) throw new HttpError(400, "INVALID_PHOTO", "Use JPG or PNG jobsite photos up to 1.5 MB each.");
      const dataUrl = imageDataUrl(file.type, new Uint8Array(await file.arrayBuffer()));
      const caption = await captionJobsitePhoto(dataUrl, file.name || "jobsite photo");
      const asset = await prisma.asset.create({ data: { companyId: job.companyId, jobId: job.id, type: "PHOTO", storageKey: dataUrl, originalFileName: file.name || null, contentType: file.type, sizeBytes: file.size, caption }, select: { id: true, caption: true } });
      photos.push(asset);
    }
    return NextResponse.json({ photos }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
