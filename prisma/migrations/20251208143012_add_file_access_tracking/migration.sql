-- CreateEnum
CREATE TYPE "EmailNotificationFrequency" AS ENUM ('IMMEDIATE', 'DAILY', 'WEEKLY', 'DISABLED');

-- CreateEnum
CREATE TYPE "EmailNotificationType" AS ENUM ('NEW_SHARES', 'SHARE_UPDATES', 'EXPIRATIONS');

-- CreateEnum
CREATE TYPE "AccessEventType" AS ENUM ('VIEW', 'DOWNLOAD', 'PREVIEW', 'SHARE_ACCESS', 'BULK_OPERATION', 'ACCESS_DENIED');

-- CreateEnum
CREATE TYPE "AccessResult" AS ENUM ('SUCCESS', 'FAILURE', 'PARTIAL');

-- AlterTable
ALTER TABLE "FileShare" ADD COLUMN     "downloadCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastAccessedAt" TIMESTAMP(3),
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailNotificationTypes" "EmailNotificationType"[] DEFAULT ARRAY['NEW_SHARES']::"EmailNotificationType"[],
ADD COLUMN     "emailNotifications" "EmailNotificationFrequency" NOT NULL DEFAULT 'IMMEDIATE',
ADD COLUMN     "emailUnsubscribed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "error" TEXT,
    "metadata" TEXT,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAccessLog" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "eventType" "AccessEventType" NOT NULL,
    "result" "AccessResult" NOT NULL DEFAULT 'SUCCESS',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "location" TEXT,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "sessionId" TEXT,
    "duration" INTEGER,
    "bytesTransferred" INTEGER,
    "errorMessage" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_userId_idx" ON "EmailLog"("userId");

-- CreateIndex
CREATE INDEX "EmailLog_emailType_idx" ON "EmailLog"("emailType");

-- CreateIndex
CREATE INDEX "EmailLog_recipient_idx" ON "EmailLog"("recipient");

-- CreateIndex
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");

-- CreateIndex
CREATE INDEX "EmailLog_sentAt_idx" ON "EmailLog"("sentAt");

-- CreateIndex
CREATE INDEX "FileAccessLog_shareId_idx" ON "FileAccessLog"("shareId");

-- CreateIndex
CREATE INDEX "FileAccessLog_userId_idx" ON "FileAccessLog"("userId");

-- CreateIndex
CREATE INDEX "FileAccessLog_fileId_idx" ON "FileAccessLog"("fileId");

-- CreateIndex
CREATE INDEX "FileAccessLog_eventType_idx" ON "FileAccessLog"("eventType");

-- CreateIndex
CREATE INDEX "FileAccessLog_result_idx" ON "FileAccessLog"("result");

-- CreateIndex
CREATE INDEX "FileAccessLog_createdAt_idx" ON "FileAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "FileAccessLog_sessionId_idx" ON "FileAccessLog"("sessionId");

-- CreateIndex
CREATE INDEX "FileAccessLog_ipAddress_idx" ON "FileAccessLog"("ipAddress");

-- CreateIndex
CREATE INDEX "FileShare_lastAccessedAt_idx" ON "FileShare"("lastAccessedAt");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAccessLog" ADD CONSTRAINT "FileAccessLog_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "FileShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAccessLog" ADD CONSTRAINT "FileAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
