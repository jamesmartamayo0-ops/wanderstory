-- AlterTable
ALTER TABLE "Destination" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Destination_featured_idx" ON "Destination"("featured");
