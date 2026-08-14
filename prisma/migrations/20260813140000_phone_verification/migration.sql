-- Phone verification is required for new sign-ups and used as the SMS
-- factor after a password sign-in. Existing accounts remain usable until
-- they add a phone number, so this rollout does not lock out owners.
ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
