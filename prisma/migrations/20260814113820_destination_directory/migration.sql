-- AlterTable
ALTER TABLE "Destination" ADD COLUMN     "continent" TEXT,
ADD COLUMN     "featuredPlace" TEXT;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "licenseName" TEXT,
ADD COLUMN     "licenseUrl" TEXT,
ADD COLUMN     "sourceAuthor" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateIndex
CREATE INDEX "Destination_continent_published_idx" ON "Destination"("continent", "published");
