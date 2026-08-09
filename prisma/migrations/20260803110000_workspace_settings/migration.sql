-- Persist per-company workspace and proposal settings.
ALTER TABLE "Company"
  ADD COLUMN "defaultDepositPercent" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "defaultProposalValidityDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "defaultWarrantyText" TEXT,
  ADD COLUMN "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
