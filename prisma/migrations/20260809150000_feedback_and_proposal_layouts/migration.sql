-- Customer-facing presentation preference saved with each proposal.
CREATE TYPE "ProposalLayout" AS ENUM ('CLEAN', 'DETAILED', 'PREMIUM');

ALTER TABLE "Proposal"
  ADD COLUMN "layout" "ProposalLayout" NOT NULL DEFAULT 'CLEAN';

-- Contractor-reported product feedback, visible to platform administrators only.
CREATE TYPE "FeedbackKind" AS ENUM ('BUG', 'FEATURE');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWING', 'PLANNED', 'RESOLVED', 'CLOSED');

CREATE TABLE "FeedbackSubmission" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "submittedById" TEXT NOT NULL,
  "kind" "FeedbackKind" NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "title" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "pageUrl" TEXT,
  "adminNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackSubmission_status_createdAt_idx" ON "FeedbackSubmission"("status", "createdAt");
CREATE INDEX "FeedbackSubmission_companyId_createdAt_idx" ON "FeedbackSubmission"("companyId", "createdAt");
CREATE INDEX "FeedbackSubmission_submittedById_createdAt_idx" ON "FeedbackSubmission"("submittedById", "createdAt");

ALTER TABLE "FeedbackSubmission"
  ADD CONSTRAINT "FeedbackSubmission_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FeedbackSubmission"
  ADD CONSTRAINT "FeedbackSubmission_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
