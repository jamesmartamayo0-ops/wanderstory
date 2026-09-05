-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "SocialDraftStatus" AS ENUM ('DRAFT', 'READY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'SOCIAL_DRAFT_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'SOCIAL_DRAFT_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'SOCIAL_DRAFT_DELETED';
ALTER TYPE "AuditEventType" ADD VALUE 'SOCIAL_DRAFT_STATUS_CHANGED';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE 'SOCIAL_DRAFT';

-- CreateTable
CREATE TABLE "SocialDraft" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "mediaId" TEXT,
    "status" "SocialDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialDraft_status_updatedAt_idx" ON "SocialDraft"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SocialDraft_mediaId_idx" ON "SocialDraft"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialDraft_journeyId_platform_key" ON "SocialDraft"("journeyId", "platform");

-- AddForeignKey
ALTER TABLE "SocialDraft" ADD CONSTRAINT "SocialDraft_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialDraft" ADD CONSTRAINT "SocialDraft_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialDraft" ADD CONSTRAINT "SocialDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
