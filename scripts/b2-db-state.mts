// USAGE: Step 4 (optional) of the B2 verification workflow. READ-ONLY
// inspection of b2 fixture state. Safe to run any time after b2-fixtures.mts;
// commonly used to confirm end state before b2-cleanup.mts.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const admins = await prisma.admin.findMany({
  where: { email: { contains: "b2-verify" } },
  select: { id: true, email: true, name: true, role: true, createdAt: true },
});
console.log("ADMINS", JSON.stringify(admins, null, 2));

for (const a of admins) {
  const j = await prisma.journey.count({ where: { authorId: a.id } });
  const m = await prisma.media.count({ where: { uploaderId: a.id } });
  console.log(`admin ${a.email}: journeys=${j} media=${m}`);
}

const journeys = await prisma.journey.findMany({
  where: { title: { contains: "B2 Verify" } },
  select: {
    id: true, slug: true, title: true, status: true, visibility: true,
    client: { select: { name: true } },
    destination: { select: { name: true } },
    categories: { select: { category: { select: { name: true } } } },
    chapters: { select: { id: true, title: true, order: true, _count: { select: { media: true } } } },
    publicationConsent: true,
  },
});
console.log("JOURNEYS", JSON.stringify(journeys, null, 2));

const clients = await prisma.client.findMany({ where: { name: { contains: "B2 Verify" } } });
const destinations = await prisma.destination.findMany({ where: { name: { contains: "B2 Verify" } } });
const categories = await prisma.category.findMany({ where: { name: { contains: "B2 Verify" } } });
console.log("CLIENTS", JSON.stringify(clients));
console.log("DESTINATIONS", JSON.stringify(destinations));
console.log("CATEGORIES", JSON.stringify(categories));

const recent = await prisma.auditLog.findMany({
  where: { createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } },
  orderBy: { createdAt: "desc" },
  take: 40,
  select: { id: true, eventType: true, actorEmail: true, targetType: true, targetId: true, metadata: true, createdAt: true },
});
console.log("AUDIT_RECENT", JSON.stringify(recent, null, 2));

await prisma.$disconnect();
