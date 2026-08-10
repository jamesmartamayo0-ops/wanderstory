// USAGE: Step 2 of the B2 verification workflow. Requires the dev server on
// localhost:3000 plus fixture data from b2-fixtures.mts. WRITES
// scripts/b2-run-start.txt at launch; b2-audit.mts READS it afterwards, so
// replay must always run before audit. Development-local only — guarded by
// assertDestructiveScriptSafe() and assertCloudinaryDestructiveSafe()
// (uploadMedia cells upload to Cloudinary via the dev server, so the target
// cloud_name must be listed in B2_ALLOWED_CLOUDINARY_CLOUD_NAMES).
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { assertCloudinaryDestructiveSafe, assertDestructiveScriptSafe } from "./b2-guard.mts";

assertDestructiveScriptSafe("b2-replay.mts");
assertCloudinaryDestructiveSafe("b2-replay.mts");

writeFileSync("scripts/b2-run-start.txt", new Date().toISOString());

const BASE = "http://localhost:3000";
const TOP = "b2v-journey-main";
const CH = "b2v-chapter-01";
const CH_MEDIA = "b2v-chapter-media";
const CLIENT = "b2v-client";
const DEST = "b2v-destination";

const SMALL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

type Cell = {
  id: string;
  label: string;
  path: string;
  actionId: string;
  args: unknown[];
  expect: "success" | "forbidden" | "redirect";
  cookie: string;
  origin?: string;
  file?: { name: string; mime: string; bytes: Buffer };
};

const results: Record<string, unknown>[] = [];

function fail(step: string, detail: string): never {
  writeFileSync("scripts/b2-results.json", JSON.stringify({ step, detail, results }, null, 2));
  console.error("VERIFICATION_FAILED:", step, "\nDETAIL:", detail);
  process.exit(1);
}

type FormArg = {
  __form: true;
  fields: Record<string, string | { kind: "file"; name: string; mime: string; bytes: Buffer }>;
};
function F(fields: FormArg["fields"]): FormArg {
  return { __form: true, fields };
}

function buildBody(args: unknown[], file?: Cell["file"]) {
  const fd = new FormData();
  let hasForm = false;
  let nextPart = 1;
  const root: unknown[] = args.map((a) => {
    if (a && typeof a === "object" && (a as FormArg).__form) {
      hasForm = true;
      const key = nextPart++;
      const prefix = `_${key}_`;
      for (const [k, v] of Object.entries((a as FormArg).fields)) {
        if (v && typeof v === "object" && (v as { kind?: string }).kind === "file") {
          const f = v as { name: string; mime: string; bytes: Buffer };
          fd.set(prefix + k, new File([f.bytes], f.name, { type: f.mime }));
        } else {
          fd.set(prefix + k, String(v));
        }
      }
      return `$K${key}`;
    }
    return a;
  });
  if (file) {
    hasForm = true;
    fd.set("_1_file", new File([file.bytes], file.name, { type: file.mime }));
    root[0] = "$K1";
  }
  if (hasForm) {
    fd.set("0", JSON.stringify(root));
    return { body: fd as unknown as BodyInit, contentType: "multipart/form-data" };
  }
  return { body: JSON.stringify(root), contentType: "text/plain;charset=UTF-8" };
}

async function call(cell: Cell): Promise<void> {
  const { body, contentType } = buildBody(cell.args, cell.file);
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE}${cell.path}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Next-Action": cell.actionId,
        Accept: "text/x-component",
        Origin: cell.origin ?? "http://localhost:3000",
        ...(contentType === "multipart/form-data" ? {} : { "Content-Type": contentType }),
        Cookie: cell.cookie,
      },
      body,
      signal: AbortSignal.timeout(90000),
    });
  } catch (e) {
    return fail(`${cell.id} ${cell.label}`, `network error: ${String(e)}`);
  }
  const raw = await res.text();
  const redirect = res.headers.get("x-action-redirect");
  const location = res.headers.get("location");
  const success = raw.includes('"success":true');
  const forbidden = raw.includes('"success":false') && raw.includes('"error":"Forbidden"');
  let passed = false;
  if (cell.expect === "success") passed = res.status === 200 && success;
  else if (cell.expect === "forbidden") passed = res.status === 200 && forbidden;
  else if (cell.expect === "redirect") {
    passed = (res.status === 303 && (redirect !== null || !!location)) || (res.status === 200 && (redirect !== null || success));
  }
  results.push({
    id: cell.id, label: cell.label, expect: cell.expect,
    status: res.status, redirect, location, passed, rawPrefix: raw.slice(0, 300),
  });
  if (!passed) {
    fail(`${cell.id} ${cell.label}`, `expected=${cell.expect} status=${res.status} redirect=${redirect} location=${location} body=${raw.slice(0, 800)}`);
  }
  console.log(`PASS ${cell.id} (${res.status}, ${Date.now() - started}ms)${location ? " loc=" + location : redirect ? " redir=" + redirect : ""}`);
}

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

function baseHeaders(jar: string): Record<string, string> {
  return { Accept: "application/json", ...(jar ? { Cookie: jar } : {}) };
}

async function login(email: string, password: string): Promise<string> {
  let jar = "";
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: baseHeaders(jar) });
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  jar = jarAdd(jar, csrfRes);
  if (!jar.includes("authjs.csrf-token")) fail("login", `no csrf cookie after /api/auth/csrf`);
  const form = new URLSearchParams({ csrfToken: csrfJson.csrfToken, email, password, callbackUrl: `${BASE}/admin` });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE, Cookie: jar },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  jar = jarAdd(jar, res);
  if (!jar.includes("authjs.session-token")) fail("login", `no session cookie for ${email} (status ${res.status}, location ${res.headers.get("location")})`);
  console.log(`LOGIN ${email} status=${res.status}`);
  return jar;
}

const A = {
  createJourney: "40fbfd528deb6245e66b46fcee0824585bd0869caa",
  updateJourney: "60a8950ebb6923e667936ae589db3511e832d324ae",
  deleteJourney: "40e2f01aef73c6e3fd43df9b3931fadd2638312340",
  updateJourneyStatus: "60fc61be9c115cae9052be6e2bb1aa7de220fd9c99",
  toggleJourneyFeatured: "40a4685b15e0ff7502b2cfd8b664197b7daccdd236",
  updateJourneyVisibility: "604460b6e42f74c4a94ba68b81a02c42c512f4f602",
  updatePublicationConsent: "609d0cb6af6a8939f5b18000229e9edc32b45e8f7e",
  autosaveJourney: "60f1848e4724fa9f94eeb3be29cd73da9c7609970a",
  createChapter: "60c218280654288d1f33c0c6f73943f3c0ff834f57",
  updateChapter: "605195ec140589c47fdbb20f9ad52cc2919c0efa4a",
  deleteChapter: "6040cd82c0ae73e1edbff7b7958038731dfd731778",
  uploadMedia: "40d6ac283b7a80620acdd1aca61c831a665e5c0d82",
  deleteMedia: "40a3e34997db73f0dfadc7090b8d7412b0da491776",
  updateMedia: "6032f9cbf226ff7066a3770fa31fa93f374a893d3c",
  attachMediaToChapter: "700279289cb9b60d3938582762787f5690868cae80",
  removeChapterMedia: "705329a12ff3f32c4ca2cd7845841c36a4e750aa08",
  deleteChapterMedia: "706b895beeaf95ae15be9e745ddf6c66cbdc48b4b1",
  reorderChapterMedia: "70f815a17cd52ab47c440a1d59b273b3f26a8cff10",
  updateChapterMediaAltText: "70b2b9a3ec030a58225650d201b75e6a9b904475f9",
  createClient: "402345a7e2ba009f45544709ac7038c080f7833996",
  updateClient: "60b98074d357cde04445ebd3b994d42296705a8dcf",
  deleteClient: "4036e5100af230df43073259cdfc61193c47c538f1",
  saveCategory: "408f1c0956959212a0b17dc32f3e03bc6f4e9046d2",
  deleteCategory: "4099e6e6135db09ac7ea2f8b5501e392401f6905aa",
  saveDestination: "401dee951c4a0ae9dc4bf8c5395e4ea43f83750c6e",
  deleteDestination: "402db8adcc3f2e8a3aa3bad926e9083c67098b19b2",
  updateDestinationPublished: "60632d6c03d7acedb454cb24324721d1764a8872fd",
};

const JOURNEY_FD: FormArg = F({
  title: "B2 Verify Main Journey",
  travelerName: "B2 Traveler",
  travelStartDate: "2026-01-01",
  travelEndDate: "2026-01-10",
  introduction: "B2 matrix update introduction",
  clientId: CLIENT,
  destinationId: DEST,
  coverMediaId: "",
  ogImageId: "",
});

let n = 0;
function cell(label: string, c: Omit<Cell, "id" | "label">) {
  n += 1;
  return { id: `m${String(n).padStart(3, "0")} ${label.slice(0, 60)}`, label, ...c };
}

const editorJar = await login("b2-verify-editor@wanderstory.test", "B2Editor!2026");
const superJar = await login("b2-verify-super@wanderstory.test", "B2Super!2026");
console.log("LOGIN_OK editor + super\n");

// ==== REGRESSION 1: deleteJourney ====
await call(cell("deleteJourney EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.deleteJourney, cookie: editorJar,
  args: ["b2v-journey-pub"], expect: "forbidden",
}));
await call(cell("deleteJourney SUPER->Success [R1]", {
  path: `/admin/journeys/${TOP}`, actionId: A.deleteJourney, cookie: superJar,
  args: ["b2v-journey-pub"], expect: "success",
}));

// ==== REGRESSION 2: deleteChapter ====
await call(cell("deleteChapter EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.deleteChapter, cookie: editorJar,
  args: [TOP, F({ chapterId: "b2v-chapter-del" })], expect: "forbidden",
}));
await call(cell("deleteChapter SUPER->Success [R2]", {
  path: `/admin/journeys/${TOP}`, actionId: A.deleteChapter, cookie: superJar,
  args: [TOP, F({ chapterId: "b2v-chapter-del" })], expect: "success",
}));

// ==== REGRESSION 3: deleteMedia (destructive) ====
await call(cell("deleteMedia EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.deleteMedia, cookie: editorJar,
  args: ["b2v-media-del"], expect: "forbidden",
}));
await call(cell("deleteMedia SUPER->Success [R3]", {
  path: `/admin/journeys/${TOP}`, actionId: A.deleteMedia, cookie: superJar,
  args: ["b2v-media-del"], expect: "success",
}));

// ==== REGRESSION 4: deleteChapterMedia ====
await call(cell("deleteChapterMedia EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.deleteChapterMedia, cookie: editorJar,
  args: [TOP, CH_MEDIA, F({ mediaId: "b2v-media-ch1" })], expect: "forbidden",
}));
await call(cell("deleteChapterMedia SUPER->Success [R4]", {
  path: `/admin/journeys/${TOP}`, actionId: A.deleteChapterMedia, cookie: superJar,
  args: [TOP, CH_MEDIA, F({ mediaId: "b2v-media-ch1" })], expect: "success",
}));

// ==== REGRESSION 5 + status chain: consent / publish / archive ====
await call(cell("updatePublicationConsent EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.updatePublicationConsent, cookie: editorJar,
  args: [TOP, F({ consentGiven: "true", consentClientId: CLIENT, consentNotes: "b2 matrix" })], expect: "forbidden",
}));
await call(cell("updateJourneyStatus REVIEW EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourneyStatus, cookie: editorJar,
  args: [TOP, F({ newStatus: "REVIEW" })], expect: "success",
}));
await call(cell("updateJourneyStatus APPROVED SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourneyStatus, cookie: superJar,
  args: [TOP, F({ newStatus: "APPROVED" })], expect: "success",
}));
await call(cell("updatePublicationConsent SUPER->Success [R5]", {
  path: `/admin/journeys/${TOP}`, actionId: A.updatePublicationConsent, cookie: superJar,
  args: [TOP, F({ consentGiven: "true", consentClientId: CLIENT, consentNotes: "b2 matrix" })], expect: "success",
}));
await call(cell("updateJourneyStatus PUBLISHED EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourneyStatus, cookie: editorJar,
  args: [TOP, F({ newStatus: "PUBLISHED" })], expect: "forbidden",
}));
await call(cell("updateJourneyStatus PUBLISHED SUPER->Success [R6a]", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourneyStatus, cookie: superJar,
  args: [TOP, F({ newStatus: "PUBLISHED" })], expect: "success",
}));
await call(cell("updateJourneyStatus ARCHIVED EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourneyStatus, cookie: editorJar,
  args: [TOP, F({ newStatus: "ARCHIVED" })], expect: "forbidden",
}));
await call(cell("updateJourneyStatus ARCHIVED SUPER->Success [R6b]", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourneyStatus, cookie: superJar,
  args: [TOP, F({ newStatus: "ARCHIVED" })], expect: "success",
}));

// ==== MATRIX: journey permissions ====
await call(cell("createJourney EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.createJourney, cookie: editorJar,
  args: [F({ title: "B2 Matrix Journey Editor", travelerName: "B2 Traveler", travelStartDate: "2026-02-01", travelEndDate: "2026-02-05", introduction: "b2 matrix create editor", clientId: CLIENT, destinationId: DEST })],
  expect: "redirect",
}));
await call(cell("createJourney SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.createJourney, cookie: superJar,
  args: [F({ title: "B2 Matrix Journey Super", travelerName: "B2 Traveler", travelStartDate: "2026-02-01", travelEndDate: "2026-02-05", introduction: "b2 matrix create super", clientId: CLIENT, destinationId: DEST })],
  expect: "redirect",
}));
await call(cell("updateJourney EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourney, cookie: editorJar,
  args: [TOP, JOURNEY_FD], expect: "success",
}));
await call(cell("updateJourney SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourney, cookie: superJar,
  args: [TOP, JOURNEY_FD], expect: "success",
}));
await call(cell("autosaveJourney EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.autosaveJourney, cookie: editorJar,
  args: [TOP, { introduction: "B2 matrix autosave editor" }], expect: "success",
}));
await call(cell("autosaveJourney SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.autosaveJourney, cookie: superJar,
  args: [TOP, { introduction: "B2 matrix autosave super" }], expect: "success",
}));
await call(cell("updateJourneyVisibility EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourneyVisibility, cookie: editorJar,
  args: [TOP, F({ visibility: "PUBLIC" })], expect: "forbidden",
}));
await call(cell("updateJourneyVisibility SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateJourneyVisibility, cookie: superJar,
  args: [TOP, F({ visibility: "PUBLIC" })], expect: "success",
}));
await call(cell("toggleJourneyFeatured EDITOR->Forbidden", {
  path: `/admin/journeys/${TOP}`, actionId: A.toggleJourneyFeatured, cookie: editorJar,
  args: [TOP], expect: "forbidden",
}));
await call(cell("toggleJourneyFeatured SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.toggleJourneyFeatured, cookie: superJar,
  args: [TOP], expect: "success",
}));

// ==== MATRIX: chapter permissions ====
await call(cell("createChapter EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.createChapter, cookie: editorJar,
  args: [TOP, F({ title: "B2 Matrix Chapter Editor", content: "b2 matrix chapter editor" })], expect: "success",
}));
await call(cell("createChapter SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.createChapter, cookie: superJar,
  args: [TOP, F({ title: "B2 Matrix Chapter Super", content: "b2 matrix chapter super" })], expect: "success",
}));
await call(cell("updateChapter EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateChapter, cookie: editorJar,
  args: [TOP, F({ chapterId: CH, title: "B2 Fixture Chapter", content: "b2 updated by editor" })], expect: "success",
}));
await call(cell("updateChapter SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateChapter, cookie: superJar,
  args: [TOP, F({ chapterId: CH, title: "B2 Fixture Chapter", content: "b2 updated by super" })], expect: "success",
}));

// ==== MATRIX: media permissions ====
await call(cell("uploadMedia EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.uploadMedia, cookie: editorJar,
  args: [F({})], file: { name: "b2-matrix-upload-editor.png", mime: "image/png", bytes: SMALL_PNG }, expect: "redirect",
}));
await call(cell("uploadMedia SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.uploadMedia, cookie: superJar,
  args: [F({})], file: { name: "b2-matrix-upload-super.png", mime: "image/png", bytes: SMALL_PNG }, expect: "redirect",
}));
await call(cell("updateMedia EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateMedia, cookie: editorJar,
  args: ["b2v-media-ch2", F({ altText: "b2 alt editor", role: "CHAPTER", order: "0" })], expect: "success",
}));
await call(cell("updateMedia SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateMedia, cookie: superJar,
  args: ["b2v-media-ch2", F({ altText: "b2 alt super", role: "CHAPTER", order: "0" })], expect: "success",
}));
await call(cell("removeChapterMedia EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.removeChapterMedia, cookie: editorJar,
  args: [TOP, CH_MEDIA, F({ mediaId: "b2v-media-ch2" })], expect: "success",
}));
await call(cell("reorderChapterMedia EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.reorderChapterMedia, cookie: editorJar,
  args: [TOP, CH_MEDIA, F({ mediaIds: ["b2v-media-ch3"] })], expect: "success",
}));
await call(cell("reorderChapterMedia SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.reorderChapterMedia, cookie: superJar,
  args: [TOP, CH_MEDIA, F({ mediaIds: ["b2v-media-ch3"] })], expect: "success",
}));
await call(cell("removeChapterMedia SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.removeChapterMedia, cookie: superJar,
  args: [TOP, CH_MEDIA, F({ mediaId: "b2v-media-ch3" })], expect: "success",
}));
await call(cell("attachMediaToChapter EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.attachMediaToChapter, cookie: editorJar,
  args: [TOP, CH_MEDIA, F({ mediaIds: ["b2v-media-ch2"] })], expect: "success",
}));
await call(cell("attachMediaToChapter SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.attachMediaToChapter, cookie: superJar,
  args: [TOP, CH_MEDIA, F({ mediaIds: ["b2v-media-ch3"] })], expect: "success",
}));
await call(cell("updateChapterMediaAltText EDITOR->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateChapterMediaAltText, cookie: editorJar,
  args: [TOP, CH_MEDIA, F({ mediaId: "b2v-media-ch2", altText: "b2 ch alt editor" })], expect: "success",
}));
await call(cell("updateChapterMediaAltText SUPER->Success", {
  path: `/admin/journeys/${TOP}`, actionId: A.updateChapterMediaAltText, cookie: superJar,
  args: [TOP, CH_MEDIA, F({ mediaId: "b2v-media-ch3", altText: "b2 ch alt super" })], expect: "success",
}));

// ==== MATRIX: client permissions ====
await call(cell("createClient EDITOR->Success", {
  path: "/admin/clients", actionId: A.createClient, cookie: editorJar,
  args: [F({ name: "B2 Matrix Client Editor", email: "b2-matrix-client-editor@wanderstory.test", phone: "", notes: "" })], expect: "success",
}));
await call(cell("createClient SUPER->Success", {
  path: "/admin/clients", actionId: A.createClient, cookie: superJar,
  args: [F({ name: "B2 Matrix Client Super", email: "b2-matrix-client-super@wanderstory.test", phone: "", notes: "" })], expect: "success",
}));
await call(cell("updateClient EDITOR->Success", {
  path: "/admin/clients", actionId: A.updateClient, cookie: editorJar,
  args: [CLIENT, F({ name: "B2 Verify Fixture Client", email: "b2-verify-client@wanderstory.test", phone: "", notes: "updated by editor" })], expect: "success",
}));
await call(cell("updateClient SUPER->Success", {
  path: "/admin/clients", actionId: A.updateClient, cookie: superJar,
  args: [CLIENT, F({ name: "B2 Verify Fixture Client", email: "b2-verify-client@wanderstory.test", phone: "", notes: "updated by super" })], expect: "success",
}));
await call(cell("deleteClient EDITOR->Forbidden", {
  path: "/admin/clients", actionId: A.deleteClient, cookie: editorJar,
  args: ["b2-matrix-client-del"], expect: "forbidden",
}));
await call(cell("deleteClient SUPER->Success", {
  path: "/admin/clients", actionId: A.deleteClient, cookie: superJar,
  args: ["b2-matrix-client-del"], expect: "success",
}));

// ==== MATRIX: category permissions ====
await call(cell("saveCategory create EDITOR->Success", {
  path: "/admin/categories", actionId: A.saveCategory, cookie: editorJar,
  args: [F({ name: "B2 Matrix Category Editor", description: "" })], expect: "success",
}));
await call(cell("saveCategory create SUPER->Success", {
  path: "/admin/categories", actionId: A.saveCategory, cookie: superJar,
  args: [F({ name: "B2 Matrix Category Super", description: "" })], expect: "success",
}));
await call(cell("saveCategory update EDITOR->Success", {
  path: "/admin/categories", actionId: A.saveCategory, cookie: editorJar,
  args: [F({ id: "b2v-category", name: "B2 Verify Category", description: "b2 fixture category" })], expect: "success",
}));
await call(cell("saveCategory update SUPER->Success", {
  path: "/admin/categories", actionId: A.saveCategory, cookie: superJar,
  args: [F({ id: "b2v-category", name: "B2 Verify Category", description: "b2 fixture category" })], expect: "success",
}));
await call(cell("deleteCategory EDITOR->Forbidden", {
  path: "/admin/categories", actionId: A.deleteCategory, cookie: editorJar,
  args: ["b2-matrix-category-del"], expect: "forbidden",
}));
await call(cell("deleteCategory SUPER->Success", {
  path: "/admin/categories", actionId: A.deleteCategory, cookie: superJar,
  args: ["b2-matrix-category-del"], expect: "success",
}));

// ==== MATRIX: destination permissions ====
await call(cell("saveDestination create EDITOR->Success", {
  path: "/admin/destinations", actionId: A.saveDestination, cookie: editorJar,
  args: [F({ name: "B2 Matrix Dest Editor", country: "Philippines", region: "", description: "" })], expect: "success",
}));
await call(cell("saveDestination create SUPER->Success", {
  path: "/admin/destinations", actionId: A.saveDestination, cookie: superJar,
  args: [F({ name: "B2 Matrix Dest Super", country: "Philippines", region: "", description: "" })], expect: "success",
}));
await call(cell("saveDestination update EDITOR->Success", {
  path: "/admin/destinations", actionId: A.saveDestination, cookie: editorJar,
  args: [F({ id: DEST, name: "B2 Verify Destination", country: "Philippines", region: "B2 Region", description: "b2 fixture destination", heroMediaId: "", featured: "false", published: "false" })], expect: "success",
}));
await call(cell("saveDestination update SUPER->Success", {
  path: "/admin/destinations", actionId: A.saveDestination, cookie: superJar,
  args: [F({ id: DEST, name: "B2 Verify Destination", country: "Philippines", region: "B2 Region", description: "b2 fixture destination", heroMediaId: "", featured: "false", published: "false" })], expect: "success",
}));
await call(cell("deleteDestination EDITOR->Forbidden", {
  path: "/admin/destinations", actionId: A.deleteDestination, cookie: editorJar,
  args: ["b2-matrix-destination-del"], expect: "forbidden",
}));
await call(cell("deleteDestination SUPER->Success", {
  path: "/admin/destinations", actionId: A.deleteDestination, cookie: superJar,
  args: ["b2-matrix-destination-del"], expect: "success",
}));
await call(cell("updateDestinationPublished EDITOR->Forbidden", {
  path: "/admin/destinations", actionId: A.updateDestinationPublished, cookie: editorJar,
  args: [DEST, true], expect: "forbidden",
}));
await call(cell("updateDestinationPublished SUPER->Success", {
  path: "/admin/destinations", actionId: A.updateDestinationPublished, cookie: superJar,
  args: [DEST, true], expect: "success",
}));

// ==== ORIGIN PROTECTION: foreign Origin must be rejected with 403 and no side effect ====
{
  const { body } = buildBody(["b2v-media-ch2", F({ altText: "should-not-write" })]);
  const res = await fetch(`${BASE}/admin/journeys/${TOP}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Next-Action": A.updateMedia,
      Accept: "text/x-component",
      Origin: "http://evil.example",
      Cookie: superJar,
    },
    body,
    signal: AbortSignal.timeout(90000),
  });
  const raw = await res.text();
  const rejected = raw.includes("Invalid Server Actions request") || res.status === 403;
  const executed = raw.includes('"success":true');
  const passedOrigin = rejected && !executed;
  results.push({ id: "origin", label: "Server Action foreign Origin -> rejected", status: res.status, passed: passedOrigin, rawPrefix: raw.slice(0, 300) });
  if (!passedOrigin) fail("origin-protection", `expected CSRF rejection, got ${res.status}, body=${raw.slice(0, 500)}`);
  console.log(`PASS origin-protection (${res.status}, rejected, action not executed)`);
}

// ==== LOGOUT via authentic NextAuth signout ====
async function signout(cookie: string, email: string) {
  let jar = cookie;
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: baseHeaders(jar) });
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  jar = jarAdd(jar, csrfRes);
  if (!jar.includes("authjs.csrf-token")) fail("signout", `${email} no csrf cookie`);
  const form = new URLSearchParams({ csrfToken: csrfJson.csrfToken, callbackUrl: `${BASE}/admin/login` });
  const res = await fetch(`${BASE}/api/auth/signout`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE, Cookie: jar },
    body: form,
    signal: AbortSignal.timeout(60000),
  });
  jar = jarAdd(jar, res);
  const tokenCleared = !jar.includes("authjs.session-token");
  results.push({ id: "signout", label: `signout ${email}`, status: res.status, passed: tokenCleared });
  if (!tokenCleared) fail("signout", `${email} session cookie not cleared (${res.status}, jar=${jar.slice(0, 120)})`);
  console.log(`PASS signout ${email} (${res.status})`);
}
await signout(editorJar, "b2-verify-editor@wanderstory.test");
await signout(superJar, "b2-verify-super@wanderstory.test");

writeFileSync("scripts/b2-results.json", JSON.stringify({ step: "COMPLETE", results }, null, 2));
console.log("\nALL_STEPS_PASSED total=" + results.length);
process.exit(0);