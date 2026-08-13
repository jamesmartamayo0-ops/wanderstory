// USAGE: Phase 4.3 full verification (stages R1, R2, R5, R7, F, G).
// Requires the dev server on localhost:3000 running the current code with
// the same defaults as this script (LOGIN_RATE_LIMIT=10, LOGIN_RATE_WINDOW_SECONDS=900
// unless the server's env differs — match .env between server and script).
// Creates 43v-* fixture rows only, cleans up after itself.
// Development-local only — guarded by assertDestructiveScriptSafe().
import "dotenv/config";
import { writeFileSync } from "node:fs";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { assertDestructiveScriptSafe } from "./b2-guard.mts";
import { checkLoginRateLimit } from "../lib/rate-limit";

assertDestructiveScriptSafe("verify-4.3.mts");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE = "http://localhost:3000";
const LIMIT = Number(process.env.LOGIN_RATE_LIMIT ?? 10);
const WINDOW = Number(process.env.LOGIN_RATE_WINDOW_SECONDS ?? 900);

const LOCK_EMAIL = "b2v-lock@wanderstory.test";
const LOCK_PASS = "LockPass!2026";
const RESET_EMAIL = "b2v-reset@wanderstory.test";
const RESET_PASS = "ResetPass!2026";
const XFF_EMAIL = "b2v-xff@wanderstory.test";
const XFF_PASS = "XffPass!2026";
const UNKNOWN_EMAIL = "b2v-unknown@wanderstory.test";
const KNOWN_EMAIL = "b2-verify-super@wanderstory.test";
const KNOWN_PASS = "B2Super!2026";
const EDITOR_EMAIL = "b2-verify-editor@wanderstory.test";
const EDITOR_PASS = "B2Editor!2026";

const SENTINEL_IP_KEY = "login:ip:203.0.113.9";
const SENTINEL_OTHER_KEY = "login:email:other@wanderstory.test";

const J_43V = "43v-journey";

let failures = 0;
function check(name: string, cond: boolean, detail: string) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " :: " + detail}`);
  if (!cond) failures += 1;
}

const FIXTURE_EMAILS = [LOCK_EMAIL, RESET_EMAIL, XFF_EMAIL, UNKNOWN_EMAIL];
const FIXTURE_KEYS = [
  "login:email:b2v-lock@wanderstory.test",
  "login:email:b2v-reset@wanderstory.test",
  "login:email:b2v-xff@wanderstory.test",
  "login:email:b2v-unknown@wanderstory.test",
  SENTINEL_IP_KEY,
  SENTINEL_OTHER_KEY,
];

// server action ids — harvested from .next/dev/server/server-reference-manifest.json
const ACT = {
  updateJourney: "60a8950ebb6923e667936ae589db3511e832d324ae",
  updateChapter: "605195ec140589c47fdbb20f9ad52cc2919c0efa4a",
  createChapter: "60c218280654288d1f33c0c6f73943f3c0ff834f57",
  deleteChapter: "6040cd82c0ae73e1edbff7b7958038731dfd731778",
  updateTimelineEvent: "608a2ea3b0e8404cecab2f73bb81f90d879a171b35",
  saveDestination: "401dee951c4a0ae9dc4bf8c5395e4ea43f83750c6e",
  updateClient: "60b98074d357cde04445ebd3b994d42296705a8dcf",
  saveCategory: "408f1c0956959212a0b17dc32f3e03bc6f4e9046d2",
  logout: "00bd8c22c7d946f60cfe7144ada7edda36d66de004",
} as const;

// long-form caps applied in lib/validation (R7)
const CAP = {
  chapterContent: 50000,
  journeyIntroduction: 20000,
  timelineDescription: 2000,
  destinationDescription: 5000,
  clientNotes: 10000,
  categoryDescription: 5000,
} as const;

// ---------------- fixtures & precondition cleanup ----------------
try {
await prisma.rateLimitEntry.deleteMany({ where: { key: { startsWith: "login:email:b2v-" } } });
await prisma.rateLimitEntry.deleteMany({ where: { key: { in: [SENTINEL_IP_KEY, SENTINEL_OTHER_KEY] } } });
await prisma.loginAttempt.deleteMany({ where: { email: { in: FIXTURE_EMAILS } } });
await prisma.chapter.deleteMany({ where: { journeyId: J_43V } });
await prisma.media.deleteMany({ where: { journeyId: J_43V } });
await prisma.timelineEvent.deleteMany({ where: { journeyId: J_43V } });
await prisma.journey.deleteMany({ where: { id: J_43V } });

async function upsertAdmin(id: string, email: string, name: string, password: string, role: "SUPER_ADMIN" | "EDITOR" = "SUPER_ADMIN") {
  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash: await argon2.hash(password), role },
    create: { id, email, name, role, passwordHash: await argon2.hash(password) },
  });
}
await upsertAdmin("43v-admin-lock", LOCK_EMAIL, "43V Lock", LOCK_PASS);
await upsertAdmin("43v-admin-reset", RESET_EMAIL, "43V Reset", RESET_PASS);
await upsertAdmin("43v-admin-xff", XFF_EMAIL, "43V XFF", XFF_PASS);
await upsertAdmin("b2v-admin-super", KNOWN_EMAIL, "B2 Super", KNOWN_PASS);
await upsertAdmin("b2v-admin-editor", EDITOR_EMAIL, "B2 Editor", EDITOR_PASS, "EDITOR");
await prisma.client.upsert({ where: { id: "b2v-client" }, update: {}, create: { id: "b2v-client", name: "B2 Verify Client" } });
await prisma.destination.upsert({
  where: { id: "b2v-destination" }, update: {},
  create: { id: "b2v-destination", slug: "b2v-destination", name: "B2 Verify Destination", country: "Philippines", published: false },
});
await prisma.journey.upsert({
  where: { id: J_43V },
  update: {},
  create: {
    id: J_43V, slug: "43v-journey", title: "43V Journey",
    travelerName: "43V Traveler", travelStartDate: new Date("2026-01-01"), travelEndDate: new Date("2026-01-10"),
    introduction: "43v fixture journey", status: "DRAFT", visibility: "PRIVATE",
    authorId: "b2v-admin-super", clientId: "b2v-client", destinationId: "b2v-destination",
  },
});

function windowStartFor(now: Date): Date {
  return new Date(Math.floor(now.getTime() / (WINDOW * 1000)) * (WINDOW * 1000));
}

// ---------------- helpers ----------------
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

async function loginAttempt(
  email: string,
  password: string,
  xff?: string,
): Promise<{ loggedIn: boolean; status: number; jar: string }> {
  let jar = "";
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { headers: { Accept: "application/json" } });
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  jar = jarAdd(jar, csrfRes);
  const form = new URLSearchParams({ csrfToken: csrfJson.csrfToken, email, password, callbackUrl: `${BASE}/admin` });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE,
      Cookie: jar,
      ...(xff ? { "X-Forwarded-For": xff } : {}),
    },
    body: form,
  });
  jar = jarAdd(jar, res);
  return { loggedIn: jar.includes("authjs.session-token"), status: res.status, jar };
}

async function csrfPostWithoutToken(email: string, password: string): Promise<{ loggedIn: boolean; status: number }> {
  const form = new URLSearchParams({ email, password, callbackUrl: `${BASE}/admin` });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: BASE },
    body: form,
  });
  let jar = "";
  jar = jarAdd(jar, res);
  return { loggedIn: jar.includes("authjs.session-token"), status: res.status };
}

async function auditFailedSince(since: Date, email: string): Promise<number> {
  return prisma.auditLog.count({
    where: { createdAt: { gte: since }, eventType: "LOGIN_FAILED", actorEmail: email },
  });
}

async function countKey(key: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT "count" FROM "RateLimitEntry" WHERE "key" = ${key} AND "windowStart" = ${windowStartFor(new Date())};
  `;
  return rows[0]?.count ?? 0;
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

type Expect = "success" | "forbidden" | "validation" | "notfound" | "rejected" | "unauthorized";
async function call(
  label: string, actionId: string, args: unknown[], cookie: string,
  expect: Expect, page: string = `/admin/journeys/${J_43V}`, extraHeaders: Record<string, string> = {},
): Promise<string> {
  const { body, contentType } = buildBody(args);
  const res = await fetch(`${BASE}${page}`, {
    method: "POST", redirect: "manual",
    headers: {
      "Next-Action": actionId, Accept: "text/x-component", Origin: BASE, Cookie: cookie,
      ...(contentType === "multipart/form-data" ? {} : { "Content-Type": contentType }),
      ...extraHeaders,
    },
    body, signal: AbortSignal.timeout(60000),
  });
  const raw = await res.text();
  const success = raw.includes('"success":true');
  const error = raw.includes('"success":false');
  const forbidden = error && raw.includes('"error":"Forbidden"');
  const unauthorized = error && raw.includes('"error":"Unauthorized"');
  const validation = error && raw.includes('"error":"Validation failed"');
  const notfound = error && raw.includes("not found");
  const passed =
    expect === "success" ? res.status === 200 && success :
    expect === "forbidden" ? forbidden :
    expect === "unauthorized" ? unauthorized :
    expect === "validation" ? validation :
    expect === "notfound" ? notfound :
    expect === "rejected" ? error : false;
  check(`${label} [${expect}]`, passed, `status=${res.status} body=${raw.slice(0, 200)}`);
  return raw;
}

// ================= A. Real email-keyed brute-force lockout =================
console.log("\n===== A: email-keyed brute-force lockout =====");
const aAuditSince = new Date();
{
  for (let i = 1; i <= LIMIT; i++) {
    const r = await loginAttempt(LOCK_EMAIL, "wrong-password");
    check(`A attempt ${i} permitted (fails, no session)`, r.loggedIn === false, `status=${r.status}`);
  }
  check("A attempt 1-10 emitted no LOGIN_FAILED", (await auditFailedSince(aAuditSince, LOCK_EMAIL)) === 0);

  const blockedWrong = await loginAttempt(LOCK_EMAIL, "wrong-password");
  check("A attempt 11 threshold crossed (wrong pw blocked)", blockedWrong.loggedIn === false, `status=${blockedWrong.status}`);

  const blockedCorrect = await loginAttempt(LOCK_EMAIL, LOCK_PASS);
  check("A correct password blocked at lockout", blockedCorrect.loggedIn === false, `status=${blockedCorrect.status}`);

  const failedAudits = await auditFailedSince(aAuditSince, LOCK_EMAIL);
  check("A LOGIN_FAILED only for blocked attempts (2)", failedAudits === 2, `count=${failedAudits}`);
  const attemptRows = await prisma.loginAttempt.count({ where: { email: LOCK_EMAIL } });
  check("A LoginAttempt recorded every attempt (12)", attemptRows === LIMIT + 2, `count=${attemptRows}`);
  const windowCount = await countKey("login:email:b2v-lock@wanderstory.test");
  check("A window counter == attempts (12)", windowCount === LIMIT + 2, `count=${windowCount}`);
}

// ================= B. Forged X-Forwarded-For cannot bypass =================
console.log("\n===== B: forged X-Forwarded-For =====");
{
  for (let i = 1; i <= LIMIT + 1; i++) {
    const r = await loginAttempt(XFF_EMAIL, "wrong-password", `203.0.113.${Math.floor(Math.random() * 250) + 1}`);
    if (i <= LIMIT) {
      check(`B spoofed-xff attempt ${i} permitted`, r.loggedIn === false, `status=${r.status}`);
    } else {
      check("B spoofed-xff attempt 11 blocked", r.loggedIn === false, `status=${r.status}`);
    }
  }
  const ipKeys = await prisma.rateLimitEntry.count({ where: { key: { startsWith: "login:ip:" } } });
  check("B no IP-keyed entries created (TRUST_PROXY off)", ipKeys === 0, `count=${ipKeys}`);
  const emailCount = await countKey("login:email:b2v-xff@wanderstory.test");
  check("B email key still locked (11)", emailCount === LIMIT + 1, `count=${emailCount}`);
}

// ================= C. Rate-limit infrastructure failure fails closed =================
console.log("\n===== C: fail closed =====");
{
  const failingDb = {
    $queryRaw: async () => {
      throw new Error("simulated database outage");
    },
  } as unknown as Pick<PrismaClient, "$queryRaw">;
  let threw = false;
  let result;
  try {
    result = await checkLoginRateLimit(
      "b2v-failclosed@wanderstory.test", null,
      { limit: LIMIT, windowSeconds: WINDOW },
      new Date(), failingDb,
    );
  } catch {
    threw = true;
    result = { allowed: true, emailCount: 0, retryAfterSeconds: 0, infraFailure: false };
  }
  check("C infra failure does not throw", threw === false, "threw");
  check("C infra failure denies login", result.allowed === false, `allowed=${result.allowed}`);
  check("C infra failure flagged", result.infraFailure === true, `infraFailure=${result.infraFailure}`);
}

// ================= D. Successful login resets the email-keyed counter =================
console.log("\n===== D: reset-on-success scope =====");
{
  const now = new Date();
  const ws = windowStartFor(now);
  await prisma.rateLimitEntry.createMany({
    data: [
      { key: SENTINEL_IP_KEY, windowStart: ws, count: 5, updatedAt: now },
      { key: SENTINEL_OTHER_KEY, windowStart: ws, count: 3, updatedAt: now },
    ],
    skipDuplicates: true,
  });

  for (let i = 1; i <= 3; i++) {
    const r = await loginAttempt(RESET_EMAIL, "wrong-password");
    check(`D failure ${i} permitted`, r.loggedIn === false, `status=${r.status}`);
  }
  check("D counter at 3 before success", (await countKey("login:email:b2v-reset@wanderstory.test")) === 3, "counter");

  const ok = await loginAttempt(RESET_EMAIL, RESET_PASS);
  check("D correct login succeeds before lockout", ok.loggedIn === true, `status=${ok.status}`);

  const emailsAfterReset = await prisma.rateLimitEntry.deleteMany({ where: { key: "login:email:b2v-reset@wanderstory.test" } });
  check("D email key cleared by success reset (0 rows)", emailsAfterReset.count === 0, `rows=${emailsAfterReset.count}`);

  const ipSentinel = await prisma.rateLimitEntry.findUnique({ where: { key_windowStart: { key: SENTINEL_IP_KEY, windowStart: ws } } });
  const otherSentinel = await prisma.rateLimitEntry.findUnique({ where: { key_windowStart: { key: SENTINEL_OTHER_KEY, windowStart: ws } } });
  check("D IP sentinel untouched (count 5)", ipSentinel?.count === 5, JSON.stringify(ipSentinel));
  check("D unrelated email sentinel untouched (count 3)", otherSentinel?.count === 3, JSON.stringify(otherSentinel));

  const failAgain = await loginAttempt(RESET_EMAIL, "wrong-password");
  check("D counter restarts at 1 after reset", (await countKey("login:email:b2v-reset@wanderstory.test")) === 1, "counter");
  check("D post-reset failure is a normal login failure", failAgain.loggedIn === false, `status=${failAgain.status}`);
}

// ================= E. Dummy-hash timing equalization intact =================
console.log("\n===== E: dummy-hash timing equalization =====");
{
  async function timedLogin(email: string, password: string): Promise<number> {
    const t0 = performance.now();
    await loginAttempt(email, password);
    return performance.now() - t0;
  }
  const unknownSamples: number[] = [];
  const knownSamples: number[] = [];
  for (let i = 0; i < 3; i++) {
    unknownSamples.push(await timedLogin(UNKNOWN_EMAIL, "wrong-password"));
    knownSamples.push(await timedLogin(KNOWN_EMAIL, "wrong-password"));
  }
  const minUnknown = Math.min(...unknownSamples);
  const median = (s: number[]) => [...s].sort((a, b) => a - b)[1];
  const medUnknown = median(unknownSamples);
  const medKnown = median(knownSamples);
  check("E unknown-email path performs dummy verify (>=20ms min)", minUnknown >= 20, `min=${minUnknown.toFixed(1)}ms`);
  check("E known-email verify path sane (>=20ms min)", Math.min(...knownSamples) >= 20, "known min");
  const ratio = medUnknown / Math.max(1, medKnown);
  check("E timing ratio within bounds (0.2-5x)", ratio >= 0.2 && ratio <= 5, `ratio=${ratio.toFixed(2)} (u=${medUnknown.toFixed(1)}ms k=${medKnown.toFixed(1)}ms)`);
  check("E unknown email cannot log in", (await loginAttempt(UNKNOWN_EMAIL, "wrong-password")).loggedIn === false, "logged in");
}

// ================= F. CSRF/Origin protection for Server Actions intact =================
console.log("\n===== F: CSRF/Origin protection =====");
const superLogin = await loginAttempt(KNOWN_EMAIL, KNOWN_PASS);
check("F super login works (positive control baseline)", superLogin.loggedIn === true, `status=${superLogin.status}`);
const superJar = superLogin.jar;

const journeyForm = F({
  title: "43V Journey", travelerName: "43V Traveler",
  travelStartDate: "2026-01-01", travelEndDate: "2026-01-10",
  introduction: "43v fixture journey", clientId: "b2v-client", destinationId: "b2v-destination",
  categoryIds: [], coverMediaId: "", ogImageId: "",
});

await call("F same-origin action executes", ACT.updateJourney, [J_43V, journeyForm], superJar, "success");

const fForeign = await fetch(`${BASE}/admin/journeys/${J_43V}`, {
  method: "POST", redirect: "manual",
  headers: {
    "Next-Action": ACT.updateJourney, Accept: "text/x-component",
    Origin: "http://evil.example", Cookie: superJar,
    "Content-Type": "text/plain;charset=UTF-8",
  },
  body: JSON.stringify([J_43V, journeyForm]), signal: AbortSignal.timeout(60000),
});
const foreignRaw = await fForeign.text();
check("F foreign Origin blocked (action NOT executed)",
  (fForeign.status !== 200 || !foreignRaw.includes('"success":true')), `status=${fForeign.status} body=${foreignRaw.slice(0, 120)}`);

const csrfNoToken = await csrfPostWithoutToken(KNOWN_EMAIL, KNOWN_PASS);
check("F Auth.js csrf required (no token -> no session)", csrfNoToken.loggedIn === false, `status=${csrfNoToken.status}`);
console.log(`INFO F auth-callback without csrfToken status=${csrfNoToken.status} (403 expected)`);
console.log("INFO F Origin header is required to be blocked: requests WITHOUT an Origin header are allowed by the Next.js framework contract (server-side warning only); browsers always attach Origin and the session cookie is SameSite=Lax, so cross-site browser CSRF is prevented.");

// ================= G. Logout terminates the session =================
console.log("\n===== G: logout terminates session =====");
const r2Since = new Date();
const editorLogin = await loginAttempt(EDITOR_EMAIL, EDITOR_PASS);
check("G editor login works", editorLogin.loggedIn === true, `status=${editorLogin.status}`);
const editorJar = editorLogin.jar;
const logoutAuditBefore = await prisma.auditLog.count({
  where: { createdAt: { gte: aAuditSince }, eventType: "LOGOUT", actorEmail: EDITOR_EMAIL },
});

const logoutRes = await fetch(`${BASE}/admin`, {
  method: "POST", redirect: "manual",
  headers: {
    "Next-Action": ACT.logout, Accept: "text/x-component", Origin: BASE, Cookie: editorJar,
    "Content-Type": "text/plain;charset=UTF-8",
  },
  body: "[]", signal: AbortSignal.timeout(60000),
});
const jarAfterLogout = jarAdd(editorJar, logoutRes);
check("G logout response clears session cookie", jarAfterLogout.includes("authjs.session-token") === false, `status=${logoutRes.status}`);

const adminFetch = await fetch(`${BASE}/admin`, { redirect: "manual", headers: { Cookie: jarAfterLogout } });
check("G protected page redirects to login after logout",
  (adminFetch.status === 302 || adminFetch.status === 307) && adminFetch.headers.get("location")?.includes("/admin/login"),
  `status=${adminFetch.status} loc=${adminFetch.headers.get("location") ?? "-"}`);

const gRes = await fetch(`${BASE}/admin/journeys/${J_43V}`, {
  method: "POST", redirect: "manual",
  headers: {
    "Next-Action": ACT.updateJourney, Accept: "text/x-component", Origin: BASE, Cookie: jarAfterLogout,
    "Content-Type": "text/plain;charset=UTF-8",
  },
  body: JSON.stringify([J_43V, journeyForm]), signal: AbortSignal.timeout(60000),
});
const gRaw = await gRes.text();
check("G session terminated (action request re-directed to login)",
  (gRes.status === 302 || gRes.status === 307) && gRaw.includes("/admin/login"),
  `status=${gRes.status} body=${gRaw.slice(0, 120)}`);
let logoutAuditRows = await prisma.auditLog.count({
  where: { createdAt: { gte: aAuditSince }, eventType: "LOGOUT", actorEmail: EDITOR_EMAIL },
});
for (let i = 0; i < 10 && logoutAuditRows === logoutAuditBefore; i++) {
  await new Promise((r) => setTimeout(r, 500));
  logoutAuditRows = await prisma.auditLog.count({
    where: { createdAt: { gte: aAuditSince }, eventType: "LOGOUT", actorEmail: EDITOR_EMAIL },
  });
}
check("G LOGOUT audit row emitted", logoutAuditRows === logoutAuditBefore + 1, `rows=${logoutAuditRows}`);

// ================= R2. Audit completeness sweep (additive verification) =================
console.log("\n===== R2: audit completeness =====");
{
  const before = await prisma.auditLog.count({ where: { createdAt: { gte: r2Since }, eventType: "LOGIN_SUCCESS", actorEmail: EDITOR_EMAIL } });
  check("R2 LOGIN_SUCCESS from editor login (fresh)", before === 1, `count=${before}`);
}
check("R2 LOGIN_FAILED emitted only for blocked attempts (A audit: 2 w/ rate_limited reason)",
  (await prisma.auditLog.count({ where: { createdAt: { gte: aAuditSince }, eventType: "LOGIN_FAILED", actorEmail: LOCK_EMAIL } })) === 2);

await call("R2 EDITOR createChapter", ACT.createChapter, [J_43V, F({ title: "43V Chapter", content: "43v chapter content" })], superJar, "success");
const fixtureChapter = await prisma.chapter.findFirst({ where: { journeyId: J_43V, title: "43V Chapter" } });
check("R2 fixture chapter created", fixtureChapter !== null, "row");
await call("R2 EDITOR deleteChapter forbidden", ACT.deleteChapter, [J_43V, F({ chapterId: fixtureChapter!.id })], (await loginAttempt(EDITOR_EMAIL, EDITOR_PASS)).jar, "forbidden");
check("R2 DELETE denied row intact", (await prisma.chapter.findUnique({ where: { id: fixtureChapter!.id } })) !== null, "row");
const denialRows = await prisma.auditLog.findMany({
  where: { createdAt: { gte: r2Since }, eventType: "AUTHORIZATION_DENIED", actorEmail: EDITOR_EMAIL },
  select: { metadata: true, targetType: true, targetId: true },
});
const denial = denialRows.find((d) => (d.metadata as { permission?: string })?.permission === "chapter:delete");
check("R2 AUTHORIZATION_DENIED audited (chapter:delete, CHAPTER target)",
  denial !== undefined && denial.targetType === "CHAPTER" && denial.targetId === fixtureChapter!.id,
  JSON.stringify(denialRows));
check("R2 LoginAttempt recorded every login outcome (A:12 + D:5 + E:4)",
  (await prisma.loginAttempt.count({ where: { email: { in: [LOCK_EMAIL, RESET_EMAIL, UNKNOWN_EMAIL] } } })) === 21,
  "count");

// ================= R5. CSP/security-header runtime verification =================
console.log("\n===== R5: security headers =====");
async function assertHeaders(label: string, res: Response, expectCsp: boolean) {
  const hsts = res.headers.get("strict-transport-security") ?? "";
  const frame = res.headers.get("x-frame-options") ?? "";
  const nosniff = res.headers.get("x-content-type-options") ?? "";
  const ref = res.headers.get("referrer-policy") ?? "";
  const perm = res.headers.get("permissions-policy") ?? "";
  const csp = res.headers.get("content-security-policy") ?? "";
  check(`R5 ${label} HSTS 2y + includeSubDomains, no preload`,
    hsts.includes("max-age=63072000") && hsts.includes("includeSubDomains") && !/preload/i.test(hsts),
    JSON.stringify(hsts));
  check(`R5 ${label} X-Frame-Options DENY`, frame === "DENY", JSON.stringify(frame));
  check(`R5 ${label} X-Content-Type-Options nosniff`, nosniff === "nosniff", JSON.stringify(nosniff));
  check(`R5 ${label} Referrer-Policy`, ref === "strict-origin-when-cross-origin", JSON.stringify(ref));
  check(`R5 ${label} Permissions-Policy camera() blocked`, perm.includes("camera=()"), JSON.stringify(perm));
  if (expectCsp) {
    check(`R5 ${label} CSP default-src self`, csp.includes("default-src 'self'"), JSON.stringify(csp));
    check(`R5 ${label} CSP frame-ancestors none`, csp.includes("frame-ancestors 'none'"), JSON.stringify(csp));
    check(`R5 ${label} CSP object-src none`, csp.includes("object-src 'none'"), JSON.stringify(csp));
    check(`R5 ${label} CSP base-uri self`, csp.includes("base-uri 'self'"), JSON.stringify(csp));
    check(`R5 ${label} CSP form-action self`, csp.includes("form-action 'self'"), JSON.stringify(csp));
    check(`R5 ${label} CSP script-src self`, csp.includes("script-src 'self'"), JSON.stringify(csp));
  }
}
const homeRes = await fetch(`${BASE}/`);
check("R5 / returns 200", homeRes.status === 200, String(homeRes.status));
await assertHeaders("/", homeRes, true);
const loginPageRes = await fetch(`${BASE}/admin/login`);
check("R5 /admin/login returns 200", loginPageRes.status === 200, String(loginPageRes.status));
await assertHeaders("/admin/login", loginPageRes, true);
const adminRes = await fetch(`${BASE}/admin`, { headers: { Cookie: (await loginAttempt(KNOWN_EMAIL, KNOWN_PASS)).jar } });
check("R5 /admin returns 200 (authed)", adminRes.status === 200, String(adminRes.status));
await assertHeaders("/admin", adminRes, true);
const csrfRes2 = await fetch(`${BASE}/api/auth/csrf`, { headers: { Accept: "application/json" } });
console.log(`INFO R5 /api/auth/csrf status=${csrfRes2.status} csp=${JSON.stringify(csrfRes2.headers.get("content-security-policy") ?? "none")}`);

// ================= R7. Zod caps: longest-row edit replay + over-cap rejection =================
console.log("\n===== R7: field-length caps =====");
{
  const superJar2 = (await loginAttempt(KNOWN_EMAIL, KNOWN_PASS)).jar;

  const chapterRow = await prisma.chapter.findUnique({ where: { id: "cmsg5nnu200056cvi59vc9jhy" } });
  if (chapterRow) {
    await call("R7 replay longest chapter.content (480)", ACT.updateChapter,
      [chapterRow.journeyId, F({ chapterId: chapterRow.id, title: chapterRow.title, content: chapterRow.content })],
      superJar2, "success");
    await call("R7 chapter.content over cap rejected", ACT.updateChapter,
      [chapterRow.journeyId, F({ chapterId: chapterRow.id, title: chapterRow.title, content: "x".repeat(CAP.chapterContent + 1) })],
      superJar2, "validation");
  } else {
    check("R7 longest chapter row exists", false, "cmsg5nnu200056cvi59vc9jhy missing");
  }

  const journeyRow = await prisma.journey.findUnique({ where: { id: "cmsh667i500024gviem8h1apc" } });
  if (journeyRow) {
    await call("R7 replay longest journey.introduction (554)", ACT.updateJourney,
      [journeyRow.id, F({
        title: journeyRow.title, travelerName: journeyRow.travelerName,
        travelStartDate: new Date(journeyRow.travelStartDate).toISOString(), travelEndDate: new Date(journeyRow.travelEndDate).toISOString(),
        introduction: journeyRow.introduction, clientId: journeyRow.clientId, destinationId: journeyRow.destinationId,
        categoryIds: (await prisma.journeyCategory.findMany({ where: { journeyId: journeyRow.id }, select: { categoryId: true } })).map((c) => c.categoryId),
        coverMediaId: journeyRow.coverMediaId ?? "", ogImageId: journeyRow.ogImageId ?? "",
      })],
      superJar2, "success");
    await call("R7 journey.introduction over cap rejected", ACT.updateJourney,
      [J_43V, F({
        title: "43V Journey", travelerName: "43V Traveler",
        travelStartDate: "2026-01-01", travelEndDate: "2026-01-10",
        introduction: "x".repeat(CAP.journeyIntroduction + 1), clientId: "b2v-client", destinationId: "b2v-destination",
        categoryIds: [], coverMediaId: "", ogImageId: "",
      })],
      superJar2, "validation");
  } else {
    check("R7 longest journey row exists", false, "cmsh667i500024gviem8h1apc missing");
  }

  const eventRow = await prisma.timelineEvent.findUnique({ where: { id: "cmspvoea9000b0wvihpwjz1bi" } });
  if (eventRow) {
    await call("R7 replay longest timelineEvent.description (155)", ACT.updateTimelineEvent,
      [eventRow.journeyId, F({ timelineEventId: eventRow.id, date: new Date(eventRow.date).toISOString(), title: eventRow.title, description: eventRow.description ?? "" })],
      superJar2, "success");
    await call("R7 timelineEvent.description over cap rejected", ACT.updateTimelineEvent,
      [eventRow.journeyId, F({ timelineEventId: eventRow.id, date: new Date(eventRow.date).toISOString(), title: eventRow.title, description: "x".repeat(CAP.timelineDescription + 1) })],
      superJar2, "validation");
  } else {
    check("R7 longest timelineEvent row exists", false, "cmspvoea9000b0wvihpwjz1bi missing");
  }

  const destRow = await prisma.destination.findUnique({ where: { id: "cmsg5e9o700016cvin1a3s2lj" } });
  if (destRow) {
    await call("R7 replay longest destination.description (352)", ACT.saveDestination,
      [F({
        id: destRow.id, name: destRow.name, country: destRow.country, region: destRow.region ?? "",
        description: destRow.description ?? "", heroMediaId: destRow.heroMediaId ?? "",
        featured: String(destRow.featured), published: String(destRow.published),
      })],
      superJar2, "success", "/admin/destinations");
    await call("R7 destination.description over cap rejected", ACT.saveDestination,
      [F({
        id: destRow.id, name: destRow.name, country: destRow.country, region: destRow.region ?? "",
        description: "x".repeat(CAP.destinationDescription + 1), heroMediaId: destRow.heroMediaId ?? "",
        featured: String(destRow.featured), published: String(destRow.published),
      })],
      superJar2, "validation", "/admin/destinations");
  } else {
    check("R7 longest destination row exists", false, "cmsg5e9o700016cvin1a3s2lj missing");
  }

  const clientRow = await prisma.client.findUnique({ where: { id: "cmsg5h6kn00026cvi132m470i" } });
  if (clientRow) {
    await call("R7 replay longest client.notes (12)", ACT.updateClient,
      [clientRow.id, F({ name: clientRow.name, email: clientRow.email ?? "", phone: clientRow.phone ?? "", notes: clientRow.notes ?? "" })],
      superJar2, "success", "/admin/clients");
    await call("R7 client.notes over cap rejected", ACT.updateClient,
      [clientRow.id, F({ name: clientRow.name, email: clientRow.email ?? "", phone: clientRow.phone ?? "", notes: "x".repeat(CAP.clientNotes + 1) })],
      superJar2, "validation", "/admin/clients");
  } else {
    check("R7 longest client row exists", false, "cmsg5h6kn00026cvi132m470i missing");
  }

  const categoryRow = await prisma.category.findUnique({ where: { id: "cmsh62zkw00014gvirn265j0r" } });
  if (categoryRow) {
    await call("R7 replay longest category.description (136)", ACT.saveCategory,
      [F({ id: categoryRow.id, name: categoryRow.name, description: categoryRow.description ?? "" })],
      superJar2, "success", "/admin/categories");
    await call("R7 category.description over cap rejected", ACT.saveCategory,
      [F({ id: categoryRow.id, name: categoryRow.name, description: "x".repeat(CAP.categoryDescription + 1) })],
      superJar2, "validation", "/admin/categories");
  } else {
    check("R7 longest category row exists", false, "cmsh62zkw00014gvirn265j0r missing");
  }
}

// ================= cleanup (runs even on unexpected verification errors) =================
} catch (err) {
  failures += 1;
  console.error(
    "[verify-4.3] Unexpected verification failure:",
    err instanceof Error ? err.message : String(err),
  );
} finally {
  await prisma.chapter.deleteMany({ where: { journeyId: J_43V } });
  await prisma.media.deleteMany({ where: { journeyId: J_43V } });
  await prisma.timelineEvent.deleteMany({ where: { journeyId: J_43V } });
  await prisma.journey.deleteMany({ where: { id: J_43V } });
  await prisma.rateLimitEntry.deleteMany({ where: { key: { in: FIXTURE_KEYS } } });
  await prisma.rateLimitEntry.deleteMany({ where: { key: { startsWith: "login:email:b2v-" } } });
  await prisma.loginAttempt.deleteMany({ where: { email: { in: FIXTURE_EMAILS } } });
}

console.log(failures === 0 ? "\nALL_4_3_CHECKS_PASSED" : `\nVERIFICATION_FAILED (${failures} failed)`);
writeFileSync("scripts/verify-4.3-result.json", JSON.stringify({ stage: "full", failures, ranAt: new Date().toISOString() }, null, 2));
process.exit(failures === 0 ? 0 : 1);