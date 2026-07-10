import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import argon2 from "argon2";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before seeding."
    );
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Admin created successfully: ${admin.email}`);

  // ──────────────────────────────────────────────
  // Phase 1.5B — Public journey consent filter seed data
  // Idempotent: uses upsert with deterministic IDs.
  // ──────────────────────────────────────────────

  const CLIENT_ID = "seed-client-p1-5b";
  const DESTINATION_ID = "seed-destination-p1-5b";
  const COVER_MEDIA_ID = "seed-media-cover-p1-5b";
  const CHAPTER_1_ID = "seed-chapter-1-p1-5b";

  // 1. Client
  const client = await prisma.client.upsert({
    where: { id: CLIENT_ID },
    update: { name: "Seed Client P1.5B" },
    create: { id: CLIENT_ID, name: "Seed Client P1.5B" },
  });
  console.log(`Client ready: ${client.id}`);

  // 2. Destination
  const destination = await prisma.destination.upsert({
    where: { id: DESTINATION_ID },
    update: { name: "Seed Destination", slug: "seed-destination", country: "Testland" },
    create: { id: DESTINATION_ID, name: "Seed Destination", slug: "seed-destination", country: "Testland" },
  });
  console.log(`Destination ready: ${destination.id}`);

  // 3. Cover media (only CASE 1 needs it)
  const coverMedia = await prisma.media.upsert({
    where: { id: COVER_MEDIA_ID },
    update: {
      fileName: "verified-public-cover.svg",
      altText: "Verified Public Journey cover",
    },
    create: {
      id: COVER_MEDIA_ID,
      fileName: "verified-public-cover.svg",
      mimeType: "image/svg+xml",
      size: 0,
      type: "IMAGE",
      provider: "local",
      url: "/destinations/placeholder-1.svg",
      role: "COVER",
      altText: "Verified Public Journey cover",
      order: 0,
      uploaderId: admin.id,
    },
  });
  console.log(`Cover media ready: ${coverMedia.id}`);

  // ──────────────────────────────────────────────
  // CASE 1 — SHOULD APPEAR
  // status: PUBLISHED, visibility: PUBLIC, consentGiven: true
  // ──────────────────────────────────────────────
  const journey1 = await prisma.journey.upsert({
    where: { id: "seed-journey-001" },
    update: {
      title: "Verified Public Journey",
      slug: "verified-public-journey",
      travelerName: "Test Traveler",
      travelStartDate: new Date("2025-01-01"),
      travelEndDate: new Date("2025-01-15"),
      introduction: "A journey visible to the public — meets all three criteria.",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      featured: true,
      publishedAt: new Date("2025-06-01"),
      authorId: admin.id,
      clientId: client.id,
      destinationId: destination.id,
      coverMediaId: coverMedia.id,
    },
    create: {
      id: "seed-journey-001",
      title: "Verified Public Journey",
      slug: "verified-public-journey",
      travelerName: "Test Traveler",
      travelStartDate: new Date("2025-01-01"),
      travelEndDate: new Date("2025-01-15"),
      introduction: "A journey visible to the public — meets all three criteria.",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      featured: true,
      publishedAt: new Date("2025-06-01"),
      authorId: admin.id,
      clientId: client.id,
      destinationId: destination.id,
      coverMediaId: coverMedia.id,
    },
  });
  console.log(`CASE 1 ready: ${journey1.title}`);

  // Chapter for CASE 1 (so _count.chapters > 0)
  await prisma.chapter.upsert({
    where: { id: CHAPTER_1_ID },
    update: {
      title: "Introduction",
      content: "First chapter of the verified public journey.",
    },
    create: {
      id: CHAPTER_1_ID,
      journeyId: journey1.id,
      title: "Introduction",
      order: 1,
      content: "First chapter of the verified public journey.",
    },
  });

  // PublicationConsent for CASE 1
  await prisma.publicationConsent.upsert({
    where: { journeyId: journey1.id },
    update: { consentGiven: true, consentedAt: new Date("2025-05-15"), clientId: client.id },
    create: { journeyId: journey1.id, consentGiven: true, consentedAt: new Date("2025-05-15"), clientId: client.id },
  });
  console.log(`  → PublicationConsent: consentGiven = true`);

  // ──────────────────────────────────────────────
  // CASE 2 — SHOULD NOT APPEAR (status is DRAFT)
  // ──────────────────────────────────────────────
  const journey2 = await prisma.journey.upsert({
    where: { id: "seed-journey-002" },
    update: {
      title: "Draft Public Journey",
      slug: "draft-public-journey",
      travelerName: "Test Traveler",
      travelStartDate: new Date("2025-02-01"),
      travelEndDate: new Date("2025-02-10"),
      introduction: "Hidden because status is DRAFT.",
      status: "DRAFT",
      visibility: "PUBLIC",
      featured: false,
      publishedAt: null,
      authorId: admin.id,
      clientId: client.id,
      destinationId: destination.id,
      coverMediaId: null,
    },
    create: {
      id: "seed-journey-002",
      title: "Draft Public Journey",
      slug: "draft-public-journey",
      travelerName: "Test Traveler",
      travelStartDate: new Date("2025-02-01"),
      travelEndDate: new Date("2025-02-10"),
      introduction: "Hidden because status is DRAFT.",
      status: "DRAFT",
      visibility: "PUBLIC",
      featured: false,
      publishedAt: null,
      authorId: admin.id,
      clientId: client.id,
      destinationId: destination.id,
    },
  });
  console.log(`CASE 2 ready: ${journey2.title}`);

  await prisma.publicationConsent.upsert({
    where: { journeyId: journey2.id },
    update: { consentGiven: true, consentedAt: new Date("2025-05-16"), clientId: client.id },
    create: { journeyId: journey2.id, consentGiven: true, consentedAt: new Date("2025-05-16"), clientId: client.id },
  });
  console.log(`  → PublicationConsent: consentGiven = true`);

  // ──────────────────────────────────────────────
  // CASE 3 — SHOULD NOT APPEAR (visibility is PRIVATE)
  // ──────────────────────────────────────────────
  const journey3 = await prisma.journey.upsert({
    where: { id: "seed-journey-003" },
    update: {
      title: "Private Published Journey",
      slug: "private-published-journey",
      travelerName: "Test Traveler",
      travelStartDate: new Date("2025-03-01"),
      travelEndDate: new Date("2025-03-10"),
      introduction: "Hidden because visibility is PRIVATE.",
      status: "PUBLISHED",
      visibility: "PRIVATE",
      featured: false,
      publishedAt: new Date("2025-06-02"),
      authorId: admin.id,
      clientId: client.id,
      destinationId: destination.id,
      coverMediaId: null,
    },
    create: {
      id: "seed-journey-003",
      title: "Private Published Journey",
      slug: "private-published-journey",
      travelerName: "Test Traveler",
      travelStartDate: new Date("2025-03-01"),
      travelEndDate: new Date("2025-03-10"),
      introduction: "Hidden because visibility is PRIVATE.",
      status: "PUBLISHED",
      visibility: "PRIVATE",
      featured: false,
      publishedAt: new Date("2025-06-02"),
      authorId: admin.id,
      clientId: client.id,
      destinationId: destination.id,
    },
  });
  console.log(`CASE 3 ready: ${journey3.title}`);

  await prisma.publicationConsent.upsert({
    where: { journeyId: journey3.id },
    update: { consentGiven: true, consentedAt: new Date("2025-05-17"), clientId: client.id },
    create: { journeyId: journey3.id, consentGiven: true, consentedAt: new Date("2025-05-17"), clientId: client.id },
  });
  console.log(`  → PublicationConsent: consentGiven = true`);

  // ──────────────────────────────────────────────
  // CASE 4 — SHOULD NOT APPEAR (consentGiven is false)
  // ──────────────────────────────────────────────
  const journey4 = await prisma.journey.upsert({
    where: { id: "seed-journey-004" },
    update: {
      title: "Unconsented Public Journey",
      slug: "unconsented-public-journey",
      travelerName: "Test Traveler",
      travelStartDate: new Date("2025-04-01"),
      travelEndDate: new Date("2025-04-10"),
      introduction: "Hidden because publicationConsent.consentGiven is false.",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      featured: false,
      publishedAt: new Date("2025-06-03"),
      authorId: admin.id,
      clientId: client.id,
      destinationId: destination.id,
      coverMediaId: null,
    },
    create: {
      id: "seed-journey-004",
      title: "Unconsented Public Journey",
      slug: "unconsented-public-journey",
      travelerName: "Test Traveler",
      travelStartDate: new Date("2025-04-01"),
      travelEndDate: new Date("2025-04-10"),
      introduction: "Hidden because publicationConsent.consentGiven is false.",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      featured: false,
      publishedAt: new Date("2025-06-03"),
      authorId: admin.id,
      clientId: client.id,
      destinationId: destination.id,
    },
  });
  console.log(`CASE 4 ready: ${journey4.title}`);

  await prisma.publicationConsent.upsert({
    where: { journeyId: journey4.id },
    update: { consentGiven: false, consentedAt: new Date("2025-05-18"), clientId: client.id },
    create: { journeyId: journey4.id, consentGiven: false, consentedAt: new Date("2025-05-18"), clientId: client.id },
  });
  console.log(`  → PublicationConsent: consentGiven = false`);

  console.log("");
  console.log("Phase 1.5B seed data complete — 4 journeys created.");
  console.log("  CASE 1 (SHOULD appear):  Verified Public Journey");
  console.log("  CASE 2 (SHOULD NOT):     Draft Public Journey       (status is DRAFT)");
  console.log("  CASE 3 (SHOULD NOT):     Private Published Journey  (visibility is PRIVATE)");
  console.log("  CASE 4 (SHOULD NOT):     Unconsented Public Journey (consentGiven is false)");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
