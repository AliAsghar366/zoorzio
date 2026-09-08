-- CreateEnum
CREATE TYPE "ChannelCredentialStatus" AS ENUM ('PENDING', 'ACTIVE', 'INVALID', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "channel_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "encryptedSecondaryToken" TEXT,
    "webhookRoutingKey" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "status" "ChannelCredentialStatus" NOT NULL DEFAULT 'PENDING',
    "lastVerifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_credentials_webhookRoutingKey_key" ON "channel_credentials"("webhookRoutingKey");

-- CreateIndex
CREATE INDEX "channel_credentials_type_status_idx" ON "channel_credentials"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "channel_credentials_userId_type_key" ON "channel_credentials"("userId", "type");

-- AddForeignKey
ALTER TABLE "channel_credentials" ADD CONSTRAINT "channel_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;