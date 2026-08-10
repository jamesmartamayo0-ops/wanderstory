// USAGE: Step 1 of the B2 verification workflow. Creates/resets the b2-*
// fixture rows (admins, journeys, chapters, media, client/category/destination)
// that b2-replay.mts and b2-audit.mts depend on. Run BEFORE b2-replay.mts.
// Development-local only — guarded by assertDestructiveScriptSafe().
import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { assertDestructiveScriptSafe } from "./b2-guard.mts";

assertDestructiveScriptSafe("b2-fixtures.mts");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const SUPER_EMAIL = "b2-verify-super@wanderstory.test";
const EDITOR_EMAIL = "b2-verify-editor@wanderstory.test";
const SUPER_PASS = "B2Super!2026";
const EDITOR_PASS = "B2Editor!2026";

const mainJourney = "b2v-journey-main";

// ---- reset idempotent state (safe to re-run between replay attempts) ----
await prisma.publicationConsent.deleteMany({ where: { journeyId: mainJourney } });
await prisma.journey.update({
  where: { id: mainJourney },
  data: { status: "DRAFT", visibility: "PRIVATE", featured: false, publishedAt: null, coverMediaId: null, ogImageId: null },
});
for (let i = 1; i <= 3; i += 1) {
  await prisma.media.updateMany({
    where: { id: `b2v-media-ch${i}` },
    data: { chapterId: null, role: "GALLERY", altText: null },
  });
}
for (let i = 1; i <= 3; i += 1) {
  await prisma.media.updateMany({
    where: { id: `b2v-media-ch${i}` },
    data: { chapterId: "b2v-chapter-media", role: "CHAPTER", order: i - 1, altText: null },
  });
}

// ensure the two fixture admins exist and have known passwords
async function ensureAdmin(email: string, name: string, role: "SUPER_ADMIN" | "EDITOR", password: string) {
  const hash = await argon2.hash(password);
  return prisma.admin.upsert({
    where: { email },
    update: { passwordHash: hash, role },
    create: {
      id: email === SUPER_EMAIL ? "b2v-admin-super" : "b2v-admin-editor",
      email,
      name,
      role,
      passwordHash: hash,
    },
  });
}

await ensureAdmin(SUPER_EMAIL, "B2 Super", "SUPER_ADMIN", SUPER_PASS);
await ensureAdmin(EDITOR_EMAIL, "B2 Editor", "EDITOR", EDITOR_PASS);

// journey the deleteJourney regression will destroy (recreate if missing)
await prisma.journey.upsert({
  where: { id: "b2v-journey-pub" },
  update: {},
  create: {
    id: "b2v-journey-pub",
    slug: "b2v-journey-pub",
    title: "B2 Verify Pub Journey",
    travelerName: "B2 Traveler",
    travelStartDate: new Date("2026-01-01"),
    travelEndDate: new Date("2026-01-10"),
    introduction: "b2 pub fixture journey",
    status: "APPROVED",
    visibility: "PRIVATE",
    authorId: "b2v-admin-super",
    clientId: "b2v-client",
    destinationId: "b2v-destination",
  },
});

// chapter the deleteChapter regression will destroy
await prisma.chapter.upsert({
  where: { id: "b2v-chapter-del" },
  update: {},
  create: {
    id: "b2v-chapter-del",
    journeyId: mainJourney,
    title: "B2 Delete Chapter",
    order: 1,
    content: "b2 delete chapter fixture",
  },
});

// media the deleteMedia regression will destroy
await prisma.media.upsert({
  where: { id: "b2v-media-del" },
  update: {},
  create: {
    id: "b2v-media-del",
    fileName: "b2v-media-del.png",
    mimeType: "image/png",
    size: 100,
    type: "IMAGE",
    format: "png",
    provider: "fixture",
    url: "https://example.invalid/b2v-media-del.png",
    role: "GALLERY",
    uploaderId: "b2v-admin-super",
  },
});

// chapter holding chapter media used by attach/detach/reorder/alt-text/deleteChapterMedia
await prisma.chapter.upsert({
  where: { id: "b2v-chapter-media" },
  update: {},
  create: {
    id: "b2v-chapter-media",
    journeyId: mainJourney,
    title: "B2 Media Chapter",
    order: 2,
    content: "b2 media chapter fixture",
  },
});

for (let i = 1; i <= 3; i += 1) {
  const id = `b2v-media-ch${i}`;
  await prisma.media.upsert({
    where: { id },
    update: {},
    create: {
      id,
      fileName: `b2v-media-ch${i}.png`,
      mimeType: "image/png",
      size: 100,
      type: "IMAGE",
      format: "png",
      provider: "fixture",
      url: `https://example.invalid/b2v-media-ch${i}.png`,
      role: "CHAPTER",
      order: i - 1,
      journeyId: mainJourney,
      chapterId: "b2v-chapter-media",
      uploaderId: "b2v-admin-super",
    },
  });
}

// client the deleteClient regression will destroy
await prisma.client.upsert({
  where: { id: "b2-matrix-client-del" },
  update: {},
  create: {
    id: "b2-matrix-client-del",
    name: "B2 Matrix Delete Client",
    email: "b2-matrix-del-client@wanderstory.test",
  },
});

// category the deleteCategory regression will destroy
await prisma.category.upsert({
  where: { id: "b2-matrix-category-del" },
  update: {},
  create: {
    id: "b2-matrix-category-del",
    slug: "b2-matrix-category-del",
    name: "B2 Matrix Delete Category",
  },
});

// destination the deleteDestination regression will destroy
await prisma.destination.upsert({
  where: { id: "b2-matrix-destination-del" },
  update: {},
  create: {
    id: "b2-matrix-destination-del",
    slug: "b2-matrix-destination-del",
    name: "B2 Matrix Delete Destination",
    country: "Philippines",
  },
});

const state = {
  super: { email: SUPER_EMAIL, password: SUPER_PASS, id: "b2v-admin-super" },
  editor: { email: EDITOR_EMAIL, password: EDITOR_PASS, id: "b2v-admin-editor" },
  journeys: [
    { id: "b2v-journey-main", title: "B2 Verify Main Journey", slugHint: "b2-verify-main-journey" },
    { id: "b2v-journey-pub", title: "B2 Verify Pub Journey" },
  ],
  chapters: ["b2v-chapter-01", "b2v-chapter-del", "b2v-chapter-media"],
  media: ["b2v-media-del", "b2v-media-ch1", "b2v-media-ch2", "b2v-media-ch3"],
  client: "b2v-client",
  destination: "b2v-destination",
  category: "b2v-category",
  deletes: { client: "b2-matrix-client-del", category: "b2-matrix-category-del", destination: "b2-matrix-destination-del" },
};
console.log("FIXTURES_READY", JSON.stringify(state, null, 2));
await prisma.$disconnect();