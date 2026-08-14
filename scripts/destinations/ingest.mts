// USAGE: `npm run destinations:ingest`
// Track A destination ingestion — seeds the Destination Directory manifest
// (data/destinations/manifest.ts) into the database and Cloudinary.
//
// IDEMPOTENT: safe to re-run. Metadata is upserted every run; the Cloudinary
// upload is skipped when the hero Media row already has a providerId.
//
// Pipeline per manifest entry:
//   manifest entry → download source image → Cloudinary (wanderstory/destination-heroes)
//   → Media row (provider=CLOUDINARY + attribution metadata) → Destination.heroMedia
//
// No image URLs are ever hotlinked into the UI — the app only ever reads the
// Cloudinary URL stored on Media.
//
// Development-local only — guarded by assertDestructiveScriptSafe() and
// assertCloudinaryDestructiveSafe(). Requires:
//   NODE_ENV != production
//   B2_ALLOW_DESTRUCTIVE=true
//   DATABASE_URL on localhost
//   B2_ALLOWED_CLOUDINARY_CLOUD_NAMES=<comma-separated allowlist incl. CLOUDINARY_CLOUD_NAME>
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import {
  assertDestructiveScriptSafe,
  assertCloudinaryDestructiveSafe,
} from "../b2-guard.mts";
import { cloudinaryProvider } from "../../services/storage/cloudinary.provider";
import { DESTINATION_MANIFEST } from "../../data/destinations/manifest";
import type { UploadResult } from "../../services/storage/storage.types";

assertDestructiveScriptSafe("destinations/ingest.mts");
assertCloudinaryDestructiveSafe("destinations/ingest.mts");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DOWNLOAD_USER_AGENT =
  "WanderStoryIngest/1.0 (track-a destination directory ingestion)";

function mediaIdFor(slug: string): string {
  return `manifest-dest-hero-${slug}`;
}

function destinationIdFor(slug: string): string {
  return `manifest-dest-${slug}`;
}

async function downloadImage(url: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const response = await fetch(url, {
    headers: { "User-Agent": DOWNLOAD_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ??
    "image/jpeg";

  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function ingestEntry(
  entry: (typeof DESTINATION_MANIFEST)[number]
): Promise<void> {
  const mediaId = mediaIdFor(entry.slug);
  const destinationId = destinationIdFor(entry.slug);

  const existingMedia = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { providerId: true },
  });

  let upload: { result: UploadResult; mimeType: string } | null = null;

  if (!existingMedia?.providerId) {
    console.log(`  Downloading: ${entry.imageUrl}`);
    const { buffer, mimeType } = await downloadImage(entry.imageUrl);

    console.log(`  Uploading to Cloudinary (wanderstory/destination-heroes)`);
    const result = await cloudinaryProvider.upload(buffer, {
      fileName: `${entry.slug}-hero.${extensionFor(mimeType)}`,
      mimeType,
      folder: "wanderstory/destination-heroes",
    });
    upload = { result, mimeType };
  }

  if (upload) {
    await prisma.media.upsert({
      where: { id: mediaId },
      update: {
        mimeType: upload.mimeType,
        format: upload.result.format ?? null,
        width: upload.result.width ?? null,
        height: upload.result.height ?? null,
        provider: "CLOUDINARY",
        providerId: upload.result.providerId,
        url: upload.result.url,
        thumbnailUrl: upload.result.thumbnailUrl ?? null,
        blurDataUrl: upload.result.blurDataUrl ?? null,
        altText: entry.alt,
        sourceUrl: entry.imageUrl,
        sourceAuthor: entry.sourceAuthor,
        licenseName: entry.licenseName,
        licenseUrl: entry.licenseUrl,
      },
      create: {
        id: mediaId,
        fileName: `${entry.slug}-hero.${extensionFor(upload.mimeType)}`,
        mimeType: upload.mimeType,
        size: 0,
        type: "IMAGE",
        format: upload.result.format ?? null,
        width: upload.result.width ?? null,
        height: upload.result.height ?? null,
        provider: "CLOUDINARY",
        providerId: upload.result.providerId,
        url: upload.result.url,
        thumbnailUrl: upload.result.thumbnailUrl ?? null,
        blurDataUrl: upload.result.blurDataUrl ?? null,
        role: "DESTINATION_HERO",
        altText: entry.alt,
        sourceUrl: entry.imageUrl,
        sourceAuthor: entry.sourceAuthor,
        licenseName: entry.licenseName,
        licenseUrl: entry.licenseUrl,
        order: 0,
      },
    });
  } else {
    await prisma.media.update({
      where: { id: mediaId },
      data: {
        altText: entry.alt,
        sourceUrl: entry.imageUrl,
        sourceAuthor: entry.sourceAuthor,
        licenseName: entry.licenseName,
        licenseUrl: entry.licenseUrl,
      },
    });
  }

  await prisma.destination.upsert({
    where: { id: destinationId },
    update: {
      slug: entry.slug,
      name: entry.country,
      country: entry.country,
      continent: entry.continent,
      featuredPlace: entry.featuredPlace,
      region: entry.region,
      description: entry.description,
      published: true,
      heroMediaId: mediaId,
    },
    create: {
      id: destinationId,
      slug: entry.slug,
      name: entry.country,
      country: entry.country,
      continent: entry.continent,
      featuredPlace: entry.featuredPlace,
      region: entry.region,
      description: entry.description,
      published: true,
      featured: false,
      heroMediaId: mediaId,
    },
  });

  console.log(
    `  ${entry.country} — ${entry.featuredPlace} ${upload ? "(uploaded)" : "(cached, upload skipped)"}`
  );
}

async function main() {
  console.log(`Ingesting ${DESTINATION_MANIFEST.length} manifest entries...`);

  for (const entry of DESTINATION_MANIFEST) {
    await ingestEntry(entry);
  }

  console.log("Ingestion complete.");
}

main()
  .catch((error) => {
    console.error("Ingestion failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
