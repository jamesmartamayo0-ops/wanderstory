/*
  Warnings:

  - You are about to drop the column `cloudinaryId` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `largeUrl` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `mediumUrl` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `webpUrl` on the `Media` table. All the data in the column will be lost.
  - Added the required column `fileName` to the `Media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `Media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `provider` to the `Media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `Media` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "MediaType" ADD VALUE 'DOCUMENT';

-- DropIndex
DROP INDEX "Media_cloudinaryId_key";

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "cloudinaryId",
DROP COLUMN "largeUrl",
DROP COLUMN "mediumUrl",
DROP COLUMN "webpUrl",
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "uploaderId" TEXT,
ALTER COLUMN "thumbnailUrl" DROP NOT NULL,
ALTER COLUMN "width" DROP NOT NULL,
ALTER COLUMN "height" DROP NOT NULL,
ALTER COLUMN "format" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Media_uploaderId_idx" ON "Media"("uploaderId");

-- CreateIndex
CREATE INDEX "Media_type_idx" ON "Media"("type");

-- CreateIndex
CREATE INDEX "Media_provider_idx" ON "Media"("provider");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
