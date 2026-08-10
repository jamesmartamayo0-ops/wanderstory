// USAGE: Step 3 of the B2 verification workflow. READ-ONLY audit verification.
// READS scripts/b2-run-start.txt (written by b2-replay.mts at launch) to bound
// the verification window — b2-replay.mts must run BEFORE this. Run BEFORE
// b2-cleanup.mts, which deletes the audit rows verified here.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const since = new Date(readFileSync("scripts/b2-run-start.txt", "utf8"));
const results: Record<string, unknown>[] = [];
let failed = false;

function check(name: string, cond: boolean, detail: string) {
  results.push({ name, pass: cond, detail });
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " :: " + detail}`);
  if (!cond) failed = true;
}

const actorEmails = ["b2-verify-editor@wanderstory.test", "b2-verify-super@wanderstory.test"];

// --- mutation audit records (successful actions) ---
const byType = await prisma.auditLog.groupBy({
  by: ["eventType"],
  where: { createdAt: { gte: since }, actorEmail: { in: actorEmails } },
  _count: { _all: true },
});
const counts = Object.fromEntries(byType.map((r) => [r.eventType, r._count._all]));

check("audit JOURNEY_CREATED x2", counts.JOURNEY_CREATED === 2, `got ${counts.JOURNEY_CREATED ?? 0}`);
check("audit JOURNEY_UPDATED >=6", (counts.JOURNEY_UPDATED ?? 0) >= 6, `got ${counts.JOURNEY_UPDATED ?? 0}`);
check("audit JOURNEY_DELETED x1", counts.JOURNEY_DELETED === 1, `got ${counts.JOURNEY_DELETED ?? 0}`);
check("audit CHAPTER_DELETED x1", counts.CHAPTER_DELETED === 1, `got ${counts.CHAPTER_DELETED ?? 0}`);
check("audit MEDIA_UPLOADED x2", counts.MEDIA_UPLOADED === 2, `got ${counts.MEDIA_UPLOADED ?? 0}`);
check("audit MEDIA_DELETED_PERMANENT x2", counts.MEDIA_DELETED_PERMANENT === 2, `got ${counts.MEDIA_DELETED_PERMANENT ?? 0}`);
check("audit PUBLICATION_CONSENT_CHANGED x1", counts.PUBLICATION_CONSENT_CHANGED === 1, `got ${counts.PUBLICATION_CONSENT_CHANGED ?? 0}`);

const statusAudits = await prisma.auditLog.findMany({
  where: { createdAt: { gte: since }, actorEmail: actorEmails[1], eventType: "JOURNEY_UPDATED" },
  select: { metadata: true },
  orderBy: { createdAt: "asc" },
});
const statusMetaList = statusAudits
  .map((a) => (a.metadata as { status?: string } | null)?.status)
  .filter((s): s is string => !!s);
check("JOURNEY_UPDATED metadata carries PUBLISHED + ARCHIVED",
  statusMetaList.includes("PUBLISHED") && statusMetaList.includes("ARCHIVED"),
  `statuses seen: ${statusMetaList.join(",")}`);

// --- AUTHORIZATION_DENIED records: one per forbidden cell with correct permission ---
const denials = await prisma.auditLog.findMany({
  where: { createdAt: { gte: since }, eventType: "AUTHORIZATION_DENIED", actorEmail: { in: actorEmails } },
  select: { actorEmail: true, targetType: true, targetId: true, metadata: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});
const perms = denials.map((d) => (d.metadata as { permission?: string }).permission ?? "?");
const expectedPerms = [
  "journey:delete", "chapter:delete", "media:delete", "media:delete", "consent:update",
  "journey:publish", "journey:archive", "journey:visibility", "journey:feature",
  "client:delete", "category:delete", "destination:delete", "destination:publish",
];
const byPerm = new Map<string, number>();
for (const p of perms) byPerm.set(p, (byPerm.get(p) ?? 0) + 1);
check("AUTHORIZATION_DENIED x13 total", denials.length === 13, `got ${denials.length} (perms: ${perms.join(",")})`);
const permOk = expectedPerms.every((p) => byPerm.get(p) === expectedPerms.filter((x) => x === p).length);
check("AUTHORIZATION_DENIED correct permission per cell", permOk, JSON.stringify(Object.fromEntries(byPerm)));
const denialActors = new Set(denials.map((d) => d.actorEmail));
check("AUTHORIZATION_DENIED all by EDITOR", denialActors.size === 1 && denialActors.has("b2-verify-editor@wanderstory.test"), JSON.stringify([...denialActors]));
const deniedTargetJourney = denials.filter((d) => d.metadata && (d.metadata as { permission?: string }).permission === "journey:publish");
check("publish denial has JOURNEY target", deniedTargetJourney.length === 1 && deniedTargetJourney[0].targetType === "JOURNEY" && deniedTargetJourney[0].targetId === "b2v-journey-main", JSON.stringify(deniedTargetJourney));

// --- LOGIN_SUCCESS / LOGOUT ---
const logins = await prisma.auditLog.findMany({
  where: { createdAt: { gte: since }, eventType: "LOGIN_SUCCESS", actorEmail: { in: actorEmails } },
  select: { actorEmail: true },
});
const loginRoles = new Set(logins.map((l) => l.actorEmail));
check("LOGIN_SUCCESS for editor + super", loginRoles.size === 2, JSON.stringify([...loginRoles]));
const logouts = await prisma.auditLog.findMany({
  where: { createdAt: { gte: since }, eventType: "LOGOUT", actorEmail: { in: actorEmails } },
  select: { actorEmail: true },
});
const logoutRoles = new Set(logouts.map((l) => l.actorEmail));
check("LOGOUT for editor + super", logoutRoles.size === 2, JSON.stringify([...logoutRoles]));

// --- regression side effects in DB ---
const pub = await prisma.journey.findUnique({ where: { id: "b2v-journey-pub" } });
check("R1 b2v-journey-pub deleted", pub === null, "still exists");
const chDel = await prisma.chapter.findUnique({ where: { id: "b2v-chapter-del" } });
check("R2 b2v-chapter-del deleted", chDel === null, "still exists");
const mDel = await prisma.media.findUnique({ where: { id: "b2v-media-del" } });
check("R3 b2v-media-del deleted", mDel === null, "still exists");
const mCh1 = await prisma.media.findUnique({ where: { id: "b2v-media-ch1" } });
check("R4 b2v-media-ch1 deleted", mCh1 === null, "still exists");

const main = await prisma.journey.findUnique({
  where: { id: "b2v-journey-main" },
  include: { publicationConsent: true },
});
check("R6 main journey status ARCHIVED", main?.status === "ARCHIVED", `got ${main?.status}`);
check("R6 main journey publishedAt set", main?.publishedAt !== null, "publishedAt null");
check("R6 main journey visibility PUBLIC", main?.visibility === "PUBLIC", `got ${main?.visibility}`);
check("R6 main journey featured true", main?.featured === true, `got ${main?.featured}`);
check("R5 consent stored consentGiven=true, client b2v-client", main?.publicationConsent?.consentGiven === true && main?.publicationConsent?.clientId === "b2v-client", JSON.stringify(main?.publicationConsent));

// origin test: attempted write must NOT have happened
const mCh2 = await prisma.media.findUnique({ where: { id: "b2v-media-ch2" }, select: { altText: true } });
check("origin test no side effect (altText unchanged)", mCh2?.altText === "b2 ch alt editor", `got ${mCh2?.altText}`);

// matrix create-side effects present (then cleanup will remove)
const matrixJourneys = await prisma.journey.count({ where: { title: { startsWith: "B2 Matrix Journey" }, createdAt: { gte: since } } });
check("matrix createJourney x2 rows", matrixJourneys === 2, `got ${matrixJourneys}`);
const matrixChapters = await prisma.chapter.count({ where: { title: { startsWith: "B2 Matrix Chapter" }, createdAt: { gte: since } } });
check("matrix createChapter x2 rows", matrixChapters === 2, `got ${matrixChapters}`);

console.log(failed ? "\nAUDIT_VERIFICATION_FAILED" : "\nAUDIT_VERIFICATION_PASSED");
await prisma.$disconnect();
process.exit(failed ? 1 : 0);