-- DropIndex
DROP INDEX "Destination_featured_idx";

-- AlterTable
ALTER TABLE "Destination" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Destination_featured_published_idx" ON "Destination"("featured", "published");
