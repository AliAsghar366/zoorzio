-- CreateEnum
CREATE TYPE "WhatsAppUnofficialStatus" AS ENUM ('DISCONNECTED', 'CONNECTING', 'CONNECTED');

-- CreateTable
CREATE TABLE "whatsapp_unofficial_sessions" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "status" "WhatsAppUnofficialStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "connectedNumber" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_unofficial_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_unofficial_auth_keys" (
    "id" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_unofficial_auth_keys_pkey" PRIMARY KEY ("id")
);
