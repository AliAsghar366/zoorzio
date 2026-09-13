-- CreateEnum
CREATE TYPE "WhatsAppBusinessConnectionStatus" AS ENUM ('ACTIVE', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "whatsapp_business_connections" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "businessId" TEXT,
    "displayPhoneNumber" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "isOnBizApp" BOOLEAN NOT NULL DEFAULT false,
    "platformType" TEXT,
    "status" "WhatsAppBusinessConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "contactsSyncRequestId" TEXT,
    "contactsSyncStartedAt" TIMESTAMP(3),
    "historySyncRequestId" TEXT,
    "historySyncStartedAt" TIMESTAMP(3),
    "historySyncDeclined" BOOLEAN NOT NULL DEFAULT false,
    "historySyncProgress" INTEGER,
    "lastSyncError" TEXT,
    "connectedByUserId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "disconnectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_business_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_business_connections_phoneNumberId_key" ON "whatsapp_business_connections"("phoneNumberId");

-- CreateIndex
CREATE INDEX "whatsapp_business_connections_status_idx" ON "whatsapp_business_connections"("status");

-- AddForeignKey
ALTER TABLE "whatsapp_business_connections" ADD CONSTRAINT "whatsapp_business_connections_connectedByUserId_fkey" FOREIGN KEY ("connectedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
