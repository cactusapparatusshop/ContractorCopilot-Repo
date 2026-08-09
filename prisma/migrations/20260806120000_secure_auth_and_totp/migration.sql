-- Account-security hardening: revocable sessions, optional TOTP, and
-- single-use recovery codes. Existing users retain sessionVersion 0 until
-- their next password reset or sign-in refresh.
ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "twoFactorSecretCiphertext" TEXT,
  ADD COLUMN "twoFactorPendingCiphertext" TEXT,
  ADD COLUMN "twoFactorPendingExpiresAt" TIMESTAMP(3),
  ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3),
  ADD COLUMN "twoFactorLastUsedCounter" INTEGER;

-- Existing active users predate email verification. Preserve their access on
-- rollout; every account created after this migration must verify first.
UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;

CREATE TABLE "TwoFactorRecoveryCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TwoFactorRecoveryCode_codeHash_key" ON "TwoFactorRecoveryCode"("codeHash");
CREATE INDEX "TwoFactorRecoveryCode_userId_usedAt_idx" ON "TwoFactorRecoveryCode"("userId", "usedAt");

ALTER TABLE "TwoFactorRecoveryCode"
  ADD CONSTRAINT "TwoFactorRecoveryCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
