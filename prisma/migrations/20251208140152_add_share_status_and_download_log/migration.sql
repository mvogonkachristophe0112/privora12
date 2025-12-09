-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterTable
ALTER TABLE "FileShare" ADD COLUMN     "status" "ShareStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "DownloadLog" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,

    CONSTRAINT "DownloadLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DownloadLog_shareId_idx" ON "DownloadLog"("shareId");

-- CreateIndex
CREATE INDEX "DownloadLog_userId_idx" ON "DownloadLog"("userId");

-- CreateIndex
CREATE INDEX "DownloadLog_fileId_idx" ON "DownloadLog"("fileId");

-- CreateIndex
CREATE INDEX "DownloadLog_action_idx" ON "DownloadLog"("action");

-- CreateIndex
CREATE INDEX "DownloadLog_timestamp_idx" ON "DownloadLog"("timestamp");

-- CreateIndex
CREATE INDEX "FileShare_status_idx" ON "FileShare"("status");

-- CreateIndex
CREATE INDEX "FileShare_sharedWithEmail_idx" ON "FileShare"("sharedWithEmail");

-- AddForeignKey
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "FileShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DownloadLog" ADD CONSTRAINT "DownloadLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
