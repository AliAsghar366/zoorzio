-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'TRIGGERED', 'SNOOZED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ToolExecutionStatus" AS ENUM ('PENDING', 'AWAITING_CONFIRMATION', 'EXECUTING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionPermissionMode" AS ENUM ('AUTO', 'CONFIRM');

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "snoozeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- Backfill: reminders that were already completed under the old
-- completedAt-only model must not be picked up by the new status-driven cron.
UPDATE "reminders" SET "status" = 'COMPLETED' WHERE "completedAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "reminders_status_scheduledAt_idx" ON "reminders"("status", "scheduledAt");

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_userId_idx" ON "contacts"("userId");

-- CreateIndex
CREATE INDEX "contacts_userId_name_idx" ON "contacts"("userId", "name");

-- CreateTable
CREATE TABLE "tool_executions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "argsHash" TEXT NOT NULL,
    "args" JSONB NOT NULL,
    "status" "ToolExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "resultSummary" TEXT,
    "externalResourceId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "tool_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tool_executions_userId_toolName_argsHash_createdAt_idx" ON "tool_executions"("userId", "toolName", "argsHash", "createdAt");

-- CreateTable
CREATE TABLE "action_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "mode" "ActionPermissionMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "action_permissions_userId_toolName_key" ON "action_permissions"("userId", "toolName");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_permissions" ADD CONSTRAINT "action_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
