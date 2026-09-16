-- CreateTable
CREATE TABLE "channel_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelType" "ChannelType" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_verifications_codeHash_key" ON "channel_verifications"("codeHash");

-- CreateIndex
CREATE INDEX "channel_verifications_userId_channelType_idx" ON "channel_verifications"("userId", "channelType");

-- AddForeignKey
ALTER TABLE "channel_verifications" ADD CONSTRAINT "channel_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
