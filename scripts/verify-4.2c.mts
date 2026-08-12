// USAGE: Phase 4.2C targeted verification. Requires the dev server on
// localhost:3000. Creates 42c-* fixture rows only, cleans up after itself.
// Part A: service-layer tests (ownership, IDOR, reorder, cascade) via tsx.
// Part B: runtime server-action tests (authz, audit, validation, IDOR) via
// the Next-Action protocol against the dev server.
// Development-local only — guarded by assertDestructiveScriptSafe().
import "dotenv/config";
import { writeFileSync } from "node:fs";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { assertDestructiveScriptSafe } from "./b2-guard.mts";
import * as tsvc from "../services/timeline-event.service";
import * as jsvc from "../services/journey.service";
import * as csvc from "../services/chapter.service";
import * as msvc from "../services/media.service";

assertDestructiveScriptSafe("verify-4.2c.mts");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE = "http://localhost:3000";
const J_A = "42c-journey-a";
const J_B = "42c-journey-b";
const J_C = "42c-journey-c";
const SUPER_EMAIL = "b2-verify-super@wanderstory.test";
const EDITOR_EMAIL = "b2-verify-editor@wanderstory.test";
const SUPER_PASS = "B2Super!2026";
const EDITOR_PASS = "B2Editor!2026";

let failures = 0;
function check(name: string, cond: boolean, detail: string) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " :: " + detail}`);
  if (!cond) failures += 1;
}

// ---------------- fixtures ----------------
await prisma.timelineEvent.deleteMany({ where: { journeyId: { startsWith: "42c-" } } });
await prisma.media.deleteMany({ where: { journeyId: { startsWith: "42c-" } } });
await prisma.chapter.deleteMany({ where: { journeyId: { startsWith: "42c-" } } });
await prisma.publicationConsent.deleteMany({ where: { journeyId: { startsWith: "42c-" } } });
await prisma.journey.deleteMany({ where: { id: { startsWith: "42c-" } } });

const hash = argon2.hash;
await prisma.admin.upsert({
  where: { email: SUPER_EMAIL },
  update: { passwordHash: await hash(SUPER_PASS), role: "SUPER_ADMIN" },
  create: { id: "b2v-admin-super", email: SUPER_EMAIL, name: "B2 Super", role: "SUPER_ADMIN", passwordHash: await hash(SUPER_PASS) },
});
await prisma.admin.upsert({
  where: { email: EDITOR_EMAIL },
  update: { passwordHash: await hash(EDITOR_PASS), role: "EDITOR" },
  create: { id: "b2v-admin-editor", email: EDITOR_EMAIL, name: "B2 Editor", role: "EDITOR", passwordHash: await hash(EDITOR_PASS) },
});
await prisma.client.upsert({ where: { id: "b2v-client" }, update: {}, create: { id: "b2v-client", name: "B2 Verify Client" } });
await prisma.destination.upsert({
  where: { id: "b2v-destination" }, update: {},
  create: { id: "b2v-destination", slug: "b2v-destination", name: "B2 Verify Destination", country: "Philippines", published: false },
});

async function makeJourney(id: string, slug: string): Promise<void> {
  await prisma.journey.upsert({
    where: { id },
    update: { status: "DRAFT", visibility: "PRIVATE", publishedAt: null },
    create: {
      id, slug, title: "42C " + id, travelerName: "42C Traveler",
      travelStartDate: new Date("2026-01-01"), travelEndDate: new Date("2026-01-10"),
      introduction: "42c fixture journey", status: "DRAFT", visibility: "PRIVATE",
      authorId: "b2v-admin-super", clientId: "b2v-client", destinationId: "b2v-destination",
    },
  });
}
await makeJourney(J_A, "42c-journey-a");
await makeJourney(J_B, "42c-journey-b");
await makeJourney(J_C, "42c-journey-c");

// ================= PART A — service layer =================
console.log("\n===== PART A: service layer =====");

let r = await tsvc.createTimelineEvent("nonexistent-journey", { date: new Date("2026-05-01"), title: "x" });
check("create nonexistent Journey rejected", !r.success && r.error === "Journey not found", JSON.stringify(r));

const evA1 = (await tsvc.createTimelineEvent(J_A, { date: new Date("2026-05-01"), title: "Event A1" })).data as { id: string };
const evA2 = (await tsvc.createTimelineEvent(J_A, { date: new Date("2026-05-02"), title: "Event A2", description: "desc A2" })).data as { id: string };
const evA3 = (await tsvc.createTimelineEvent(J_A, { date: new Date("2026-05-03"), title: "Event A3" })).data as { id: string };
const evB1 = (await tsvc.createTimelineEvent(J_B, { date: new Date("2026-06-01"), title: "Event B1" })).data as { id: string };

let events = await tsvc.getTimelineEventsByJourney(J_A);
check("create appends orders 1,2,3",
  events.map((e) => `${e.title}:${e.order}`).join(",") === "Event A1:1,Event A2:2,Event A3:3",
  JSON.stringify(events.map((e) => ({ t: e.title, o: e.order }))));

r = await tsvc.updateTimelineEvent(J_A, evA2.id, { date: new Date("2026-05-02"), title: "Event A2 updated", description: "new desc" });
check("update success", r.success === true, JSON.stringify(r));
const a2row = await prisma.timelineEvent.findUnique({ where: { id: evA2.id } });
check("update persisted", a2row?.title === "Event A2 updated" && a2row?.description === "new desc", JSON.stringify(a2row));

r = await tsvc.updateTimelineEvent(J_A, evB1.id, { date: new Date("2026-06-01"), title: "HACK" });
check("UPDATE IDOR rejected (journey A + B's event)", !r.success && r.error === "Timeline event not found", JSON.stringify(r));
const b1row = await prisma.timelineEvent.findUnique({ where: { id: evB1.id } });
check("UPDATE IDOR: event B unchanged", b1row?.title === "Event B1", JSON.stringify(b1row));

r = await tsvc.updateTimelineEvent(J_A, "nonexistent-event", { date: new Date("2026-05-02"), title: "x" });
check("update nonexistent event rejected", !r.success && r.error === "Timeline event not found", JSON.stringify(r));

r = await tsvc.reorderTimelineEvents(J_A, [evA3.id, evA1.id, evA2.id]);
check("reorder success", r.success === true, JSON.stringify(r));
events = await tsvc.getTimelineEventsByJourney(J_A);
check("reorder applied (A3:0,A1:1,A2:2)",
  events.map((e) => `${e.id}:${e.order}`).join(",") === `${evA3.id}:0,${evA1.id}:1,${evA2.id}:2`,
  JSON.stringify(events.map((e) => ({ id: e.id, o: e.order, t: e.title }))));

const ordersBefore = new Map((await tsvc.getTimelineEventsByJourney(J_A)).map((e) => [e.id, e.order]));
r = await tsvc.reorderTimelineEvents(J_A, [evB1.id, evA1.id, evA2.id]);
check("REORDER IDOR rejected (foreign event id)", !r.success, JSON.stringify(r));
events = await tsvc.getTimelineEventsByJourney(J_A);
check("REORDER IDOR: journey A orders unchanged",
  events.every((e) => ordersBefore.get(e.id) === e.order), JSON.stringify(events.map((e) => ({ id: e.id, o: e.order }))));
const b1After = await prisma.timelineEvent.findUnique({ where: { id: evB1.id } });
check("REORDER IDOR: event B order unchanged", b1After?.order === 1, JSON.stringify(b1After));

r = await tsvc.reorderTimelineEvents(J_A, [evA1.id, evA2.id, "unknown-id"]);
check("reorder unknown id rejected", !r.success, JSON.stringify(r));
events = await tsvc.getTimelineEventsByJourney(J_A);
check("reorder unknown id: orders unchanged",
  events.every((e) => ordersBefore.get(e.id) === e.order), JSON.stringify(events.map((e) => ({ id: e.id, o: e.order }))));

r = await tsvc.deleteTimelineEvent(J_A, evA3.id);
check("delete success", r.success === true, JSON.stringify(r));
events = await tsvc.getTimelineEventsByJourney(J_A);
check("delete removes event", events.length === 2 && !events.some((e) => e.id === evA3.id), JSON.stringify(events.map((e) => e.title)));

r = await tsvc.deleteTimelineEvent(J_A, evB1.id);
check("DELETE IDOR rejected (journey A + B's event)", !r.success && r.error === "Timeline event not found", JSON.stringify(r));
check("DELETE IDOR: event B intact", (await prisma.timelineEvent.findUnique({ where: { id: evB1.id } })) !== null);

await prisma.journey.delete({ where: { id: J_C } });
const cascadeCount = await prisma.timelineEvent.count({ where: { journeyId: J_C } });
check("journey cascade deletes its events", cascadeCount === 0, `count=${cascadeCount}`);

// ================= PART B — runtime server actions =================
console.log("\n===== PART B: server actions =====");

function jarAdd(jar: string, res: Response): string {
  const setCookies = typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : (res.headers.get("set-cookie") ?? "").split(/,\s*(?=[^;]+=)/);
  for (const c of setCookies) {
    const [pair, ...rest] = c.split(";");
    const name = pair.split("=")[0].trim();
    const expired = rest.some((p) => /expires=/i.test(p) && /1970/i.test(p)) || /max-age=0/i.test(rest.join(" "));
    if (expired) {
      jar = jar.split("; ").filter((p) => !p.startsWith(name + "=")).join("; ");
    } else {
      jar = [...jar.split("; ").filter((p) => p && !p.startsWith(name + "=")), pair].join("; ");
    }
  }
  return jar;
}
async function login(email: string, password: string): Promise<string> {
  let jar = "";
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { Accept: "application/json" } });
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  jar = jarAdd(jar, csrfRes);
  const form = new URLSearchParams({ csrfToken: csrfJson.csrfToken, email, password, callbackUrl: `${BASE}/admin` });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE, Cookie: jar },
    body: form,
  });
  jar = jarAdd(jar, res);
  if (!jar.includes("authjs.session-token")) throw new Error(`login failed for ${email} status=${res.status}`);
  return jar;
}

type FormArg = { __form: true; fields: Record<string, string | string[]> };
const F = (fields: FormArg["fields"]): FormArg => ({ __form: true, fields });

function buildBody(args: unknown[]) {
  const fd = new FormData();
  let hasForm = false;
  let nextPart = 1;
  const root: unknown[] = args.map((a) => {
    if (a && typeof a === "object" && (a as FormArg).__form) {
      hasForm = true;
      const key = nextPart++;
      const prefix = `_${key}_`;
      for (const [k, v] of Object.entries((a as FormArg).fields)) {
        if (Array.isArray(v)) {
          for (const item of v) fd.append(prefix + k, String(item));
        } else {
          fd.set(prefix + k, String(v));
        }
      }
      return `$K${key}`;
    }
    return a;
  });
  if (hasForm) {
    fd.set("0", JSON.stringify(root));
    return { body: fd as unknown as BodyInit, contentType: "multipart/form-data" };
  }
  return { body: JSON.stringify(root), contentType: "text/plain;charset=UTF-8" };
}

type Expect = "success" | "forbidden" | "validation" | "notfound" | "rejected";
async function call(label: string, actionId: string, args: unknown[], cookie: string, expect: Expect): Promise<string> {
  const { body, contentType } = buildBody(args);
  const res = await fetch(`${BASE}/admin/journeys/${J_A}`, {
    method: "POST", redirect: "manual",
    headers: {
      "Next-Action": actionId, Accept: "text/x-component", Origin: BASE, Cookie: cookie,
      ...(contentType === "multipart/form-data" ? {} : { "Content-Type": contentType }),
    },
    body, signal: AbortSignal.timeout(60000),
  });
  const raw = await res.text();
  const success = raw.includes('"success":true');
  const error = raw.includes('"success":false');
  const forbidden = error && raw.includes('"error":"Forbidden"');
  const validation = error && raw.includes('"error":"Validation failed"');
  const notfound = error && raw.includes("not found");
  const passed =
    expect === "success" ? res.status === 200 && success :
    expect === "forbidden" ? forbidden :
    expect === "validation" ? validation :
    expect === "notfound" ? notfound :
    expect === "rejected" ? error : false;
  check(`${label} [${expect}]`, passed, `status=${res.status} body=${raw.slice(0, 300)}`);
  return raw;
}

const A = {
  createTimelineEvent: "60b5d8dd106def50ec4c028272ebaf7a1911cd057a",
  updateTimelineEvent: "608a2ea3b0e8404cecab2f73bb81f90d879a171b35",
  deleteTimelineEvent: "60582296aa1dbab640f47c45136e67c3b1afa850e2",
  reorderTimelineEvents: "605717394d1d7975a52e269bf5d644af3a5fd738ae",
  createChapter: "60c218280654288d1f33c0c6f73943f3c0ff834f57",
  updateChapter: "605195ec140589c47fdbb20f9ad52cc2919c0efa4a",
  deleteChapter: "6040cd82c0ae73e1edbff7b7958038731dfd731778",
  attachMediaToChapter: "700279289cb9b60d3938582762787f5690868cae80",
  removeChapterMedia: "705329a12ff3f32c4ca2cd7845841c36a4e750aa08",
  reorderChapterMedia: "70f815a17cd52ab47c440a1d59b273b3f26a8cff10",
  updateJourney: "60a8950ebb6923e667936ae589db3511e832d324ae",
};

const auditSince = new Date();
const editorJar = await login(EDITOR_EMAIL, EDITOR_PASS);
const superJar = await login(SUPER_EMAIL, SUPER_PASS);
check("logins ok", editorJar.includes("authjs.session-token") && superJar.includes("authjs.session-token"), "jar check");

// publish journey A so public rendering is testable (PUBLISHED + PUBLIC + consent)
await prisma.journey.update({
  where: { id: J_A },
  data: { status: "PUBLISHED", visibility: "PUBLIC", publishedAt: new Date() },
});
await prisma.publicationConsent.upsert({
  where: { journeyId: J_A },
  update: { consentGiven: true, consentedAt: new Date() },
  create: { journeyId: J_A, clientId: "b2v-client", consentGiven: true, consentedAt: new Date() },
});

// EDITOR create/update allowed; delete forbidden
await call("EDITOR create", A.createTimelineEvent, [J_A, F({ date: "2026-07-01", title: "E Edit 1", description: "" })], editorJar, "success");
events = await tsvc.getTimelineEventsByJourney(J_A);
const eEdit = events.find((e) => e.title === "E Edit 1");
check("EDITOR create persisted w/ append order", eEdit !== undefined && eEdit.order === 3, JSON.stringify(events.map((e) => `${e.title}:${e.order}`)));

await call("EDITOR update", A.updateTimelineEvent, [J_A, F({ timelineEventId: eEdit!.id, date: "2026-07-02", title: "E Edit 1 updated", description: "edited" })], editorJar, "success");
check("EDITOR update persisted", (await prisma.timelineEvent.findUnique({ where: { id: eEdit!.id } }))?.title === "E Edit 1 updated", "row check");

await call("EDITOR delete forbidden", A.deleteTimelineEvent, [J_A, F({ timelineEventId: eEdit!.id })], editorJar, "forbidden");
check("EDITOR delete did not remove event", (await prisma.timelineEvent.findUnique({ where: { id: eEdit!.id } })) !== null, "row check");

// SUPER create/update/reorder/delete + validation rejects
await call("SUPER create", A.createTimelineEvent, [J_A, F({ date: "2026-07-03", title: "S Sup 1", description: "public visible" })], superJar, "success");
events = await tsvc.getTimelineEventsByJourney(J_A);
const eSup = events.find((e) => e.title === "S Sup 1");
check("SUPER create persisted", eSup !== undefined, JSON.stringify(events.map((e) => e.title)));

await call("SUPER update", A.updateTimelineEvent, [J_A, F({ timelineEventId: eSup!.id, date: "2026-07-04", title: "S Sup 1 updated", description: "public visible" })], superJar, "success");
check("SUPER update persisted", (await prisma.timelineEvent.findUnique({ where: { id: eSup!.id } }))?.title === "S Sup 1 updated", "row check");

await call("malformed date rejected", A.createTimelineEvent, [J_A, F({ date: "not-a-date", title: "Bad" })], superJar, "validation");
await call("empty title rejected", A.createTimelineEvent, [J_A, F({ date: "2026-07-05", title: "" })], superJar, "validation");

// reorder current A set: [E Edit 1 updated, S Sup 1 updated, A1, A2]
const cur = (await tsvc.getTimelineEventsByJourney(J_A)).map((e) => e.id);
const targetOrder = [cur[1], cur[0], cur[2], cur[3]];
await call("SUPER reorder", A.reorderTimelineEvents, [J_A, F({ eventIds: targetOrder })], superJar, "success");
events = await tsvc.getTimelineEventsByJourney(J_A);
check("reorder applied via action",
  events.map((e) => e.id).join(",") === targetOrder.join(",") && events.map((e) => e.order).join(",") === "0,1,2,3",
  JSON.stringify(events.map((e) => ({ id: e.id, o: e.order }))));

// cross-journey via actions: B's event against A
await call("action UPDATE IDOR", A.updateTimelineEvent, [J_A, F({ timelineEventId: evB1.id, date: "2026-06-01", title: "HACK", description: "" })], superJar, "notfound");
check("action UPDATE IDOR: B unchanged", (await prisma.timelineEvent.findUnique({ where: { id: evB1.id } }))?.title === "Event B1", "row check");
await call("action DELETE IDOR", A.deleteTimelineEvent, [J_A, F({ timelineEventId: evB1.id })], superJar, "notfound");
check("action DELETE IDOR: B intact", (await prisma.timelineEvent.findUnique({ where: { id: evB1.id } })) !== null, "row check");
const aBefore = (await tsvc.getTimelineEventsByJourney(J_A)).map((e) => `${e.id}:${e.order}`).join(",");
await call("action REORDER IDOR", A.reorderTimelineEvents, [J_A, F({ eventIds: [evB1.id, targetOrder[1], targetOrder[2], targetOrder[3]] })], superJar, "rejected");
const aAfter = (await tsvc.getTimelineEventsByJourney(J_A)).map((e) => `${e.id}:${e.order}`).join(",");
check("action REORDER IDOR: A unchanged", aBefore === aAfter, `${aBefore} -> ${aAfter}`);
check("action REORDER IDOR: B unchanged", (await prisma.timelineEvent.findUnique({ where: { id: evB1.id } }))?.order === 1, "row check");

// public rendering of a created event
const pubHtml = await (await fetch(`${BASE}/journeys/42c-journey-a`)).text();
check("public page renders timeline event", pubHtml.includes("S Sup 1 updated"), "page html search");

// SUPER delete
await call("SUPER delete", A.deleteTimelineEvent, [J_A, F({ timelineEventId: eSup!.id })], superJar, "success");
check("SUPER delete removed event", (await prisma.timelineEvent.findUnique({ where: { id: eSup!.id } })) === null, "row check");

// audit assertions
const audits = await prisma.auditLog.findMany({
  where: { createdAt: { gte: auditSince } },
  select: { eventType: true, actorEmail: true, targetType: true, targetId: true, metadata: true },
  orderBy: { createdAt: "asc" },
});
const counts = audits.reduce((acc, a) => { acc[a.eventType] = (acc[a.eventType] ?? 0) + 1; return acc; }, {} as Record<string, number>);
check("audit TIMELINE_EVENT_CREATED x2", counts.TIMELINE_EVENT_CREATED === 2, JSON.stringify(counts));
check("audit TIMELINE_EVENT_UPDATED x2", counts.TIMELINE_EVENT_UPDATED === 2, JSON.stringify(counts));
check("audit TIMELINE_EVENT_DELETED x1", counts.TIMELINE_EVENT_DELETED === 1, JSON.stringify(counts));
const denial = audits.find((a) => a.eventType === "AUTHORIZATION_DENIED" && (a.metadata as { permission?: string })?.permission === "timeline:delete");
check("audit AUTHORIZATION_DENIED timeline:delete by EDITOR",
  denial !== undefined && denial.actorEmail === EDITOR_EMAIL && denial.targetType === "TIMELINE_EVENT" && denial.targetId === eEdit!.id,
  JSON.stringify(denial));

// ================= PART C — regression smokes =================
console.log("\n===== PART C: regression smokes =====");

// Journey CRUD: updateJourney action (complete form, mirroring the admin UI)
await call("regression updateJourney", A.updateJourney, [J_A, F({
  title: "42C Journey A renamed",
  travelerName: "42C Traveler",
  travelStartDate: "2026-01-01",
  travelEndDate: "2026-01-10",
  introduction: "42c fixture journey",
  clientId: "b2v-client",
  destinationId: "b2v-destination",
  categoryIds: [],
  coverMediaId: "",
  ogImageId: "",
})], superJar, "success");
check("journey updated", (await prisma.journey.findUnique({ where: { id: J_A } }))?.title === "42C Journey A renamed", "row check");

// Chapter CRUD via actions on journey A
await call("regression createChapter", A.createChapter, [J_A, F({ title: "42C Chapter", content: "42c chapter content" })], superJar, "success");
const ch = await prisma.chapter.findFirst({ where: { journeyId: J_A, title: "42C Chapter" } });
check("chapter created", ch !== null, "row check");
await call("regression updateChapter", A.updateChapter, [J_A, F({ chapterId: ch!.id, title: "42C Chapter updated", content: "updated" })], superJar, "success");
check("chapter updated", (await prisma.chapter.findUnique({ where: { id: ch!.id } }))?.title === "42C Chapter updated", "row check");

// Media attach/reorder/remove smoke (fixture provider, no Cloudinary)
await prisma.media.createMany({
  data: [
    { id: "42c-media-1", fileName: "m1.png", mimeType: "image/png", size: 10, type: "IMAGE", format: "png", provider: "fixture", url: "https://example.invalid/m1.png", role: "GALLERY", uploaderId: "b2v-admin-super" },
    { id: "42c-media-2", fileName: "m2.png", mimeType: "image/png", size: 10, type: "IMAGE", format: "png", provider: "fixture", url: "https://example.invalid/m2.png", role: "GALLERY", uploaderId: "b2v-admin-super" },
  ],
  skipDuplicates: true,
});
await call("regression attachMedia", A.attachMediaToChapter, [J_A, ch!.id, F({ mediaIds: ["42c-media-1", "42c-media-2"] })], superJar, "success");
check("media attached", (await prisma.media.count({ where: { chapterId: ch!.id } })) === 2, "count");
await call("regression reorderChapterMedia", A.reorderChapterMedia, [J_A, ch!.id, F({ mediaIds: ["42c-media-2", "42c-media-1"] })], superJar, "success");
const mOrders = await prisma.media.findMany({ where: { chapterId: ch!.id }, orderBy: { order: "asc" }, select: { id: true, order: true } });
check("media reordered", mOrders.map((m) => m.id).join(",") === "42c-media-2,42c-media-1" && mOrders.map((m) => m.order).join(",") === "0,1", JSON.stringify(mOrders));
await call("regression removeChapterMedia", A.removeChapterMedia, [J_A, ch!.id, F({ mediaId: "42c-media-1" })], superJar, "success");
check("media removed", (await prisma.media.count({ where: { chapterId: ch!.id } })) === 1, "count");
await call("regression deleteChapter", A.deleteChapter, [J_A, F({ chapterId: ch!.id })], superJar, "success");
check("chapter deleted", (await prisma.chapter.findUnique({ where: { id: ch!.id } })) === null, "row check");

// ================= cleanup =================
await prisma.timelineEvent.deleteMany({ where: { journeyId: { in: [J_A, J_B] } } });
await prisma.media.deleteMany({ where: { journeyId: { in: [J_A, J_B] } } });
await prisma.chapter.deleteMany({ where: { journeyId: { in: [J_A, J_B] } } });
await prisma.publicationConsent.deleteMany({ where: { journeyId: { in: [J_A, J_B] } } });
await prisma.journey.deleteMany({ where: { id: { in: [J_A, J_B] } } });

console.log(failures === 0 ? "\nALL_4_2C_CHECKS_PASSED" : `\nVERIFICATION_FAILED (${failures} failed)`);
writeFileSync("scripts/verify-4.2c-result.json", JSON.stringify({ failures, ranAt: new Date().toISOString() }, null, 2));
process.exit(failures === 0 ? 0 : 1);
