// USAGE: Step 5 (LAST) of the B2 verification workflow. Removes every b2-*
// fixture row, the audit rows b2-audit.mts reads, and the Cloudinary assets
// created by b2-replay.mts. Run AFTER b2-audit.mts. Development-local only —
// guarded by assertDestructiveScriptSafe() and assertCloudinaryDestructiveSafe()
// (requires B2_ALLOWED_CLOUDINARY_CLOUD_NAMES to list the target cloud_name).
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { assertCloudinaryDestructiveSafe, assertDestructiveScriptSafe } from "./b2-guard.mts";

assertDestructiveScriptSafe("b2-cleanup.mts");
assertCloudinaryDestructiveSafe("b2-cleanup.mts");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const adminEmails = ["b2-verify-editor@wanderstory.test", "b2-verify-super@wanderstory.test"];

const matrixJourneys = await prisma.journey.findMany({
  where: { title: { startsWith: "B2 Matrix Journey" } },
  select: { id: true },
});
const journeyIds = ["b2v-journey-main", ...matrixJourneys.map((j) => j.id)];

const allMedia = await prisma.media.findMany({
  where: { OR: [{ id: { startsWith: "b2v-" } }, { id: { startsWith: "b2a-" } }] },
  select: { id: true, providerId: true },
});
const cloudinaryIds = [...new Set(allMedia.map((m) => m.providerId).filter(Boolean))];

let destroyed = 0;
let destroyedFailed = 0;
for (const pid of cloudinaryIds) {
  try {
    await cloudinary.api.deleteResources([pid], { resource_type: "auto" });
    destroyed++;
  } catch (e) {
    destroyedFailed++;
    console.error(`cloudinary destroy failed for ${pid}: ${(e as Error).message}`);
  }
}

const deletedAudit = await prisma.auditLog.deleteMany({
  where: { OR: [{ actorEmail: { in: adminEmails } }, { targetId: { in: journeyIds } }] },
});
const deletedChapters = await prisma.chapter.deleteMany({ where: { journeyId: { in: journeyIds } } });
const deletedJourneys = await prisma.journey.deleteMany({ where: { id: { in: journeyIds } } });
const deletedMedia = await prisma.media.deleteMany({
  where: { OR: [{ id: { startsWith: "b2v-" } }, { id: { startsWith: "b2a-" } }] },
});
const deletedClients = await prisma.client.deleteMany({ where: { id: { startsWith: "b2v-" } } });
const deletedCategories = await prisma.category.deleteMany({ where: { name: { startsWith: "B2 Verify" } } });
const deletedDestinations = await prisma.destination.deleteMany({ where: { name: { startsWith: "B2 Verify" } } });
const deletedAdmins = await prisma.admin.deleteMany({ where: { email: { in: adminEmails } } });

console.log(JSON.stringify({
  cloudinaryDestroyed: destroyed,
  cloudinaryDestroyFailed: destroyedFailed,
  cloudinaryIds,
  auditRows: deletedAudit.count,
  chapters: deletedChapters.count,
  journeys: deletedJourneys.count,
  media: deletedMedia.count,
  clients: deletedClients.count,
  categories: deletedCategories.count,
  destinations: deletedDestinations.count,
  admins: deletedAdmins.count,
}, null, 2));

await prisma.$disconnect();