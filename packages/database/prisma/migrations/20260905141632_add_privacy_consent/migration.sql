-- AlterTable
ALTER TABLE "users" ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "privacyPolicyVersion" TEXT;
