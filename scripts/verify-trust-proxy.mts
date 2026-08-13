// USAGE: Phase 4.3 H-1 — targeted TRUST_PROXY=1 rate-limit verification.
// Requires the dev server on localhost:3000 running the CURRENT code AND
// started with TRUST_PROXY=1 (e.g. `TRUST_PROXY=1 npm run dev`). The server
// and this script must share the same LOGIN_RATE_LIMIT / LOGIN_RATE_WINDOW_SECONDS
// defaults (10 / 900 from .env).
//
// Proves: X-Forwarded-For is trusted (IP keys created), distinct spoofed XFF
// values map to distinct client IP counters, the IP-keyed limit blocks while
// the email counter stays under the limit, email-keyed limiting still works,
// and a legitimate login still succeeds (with the email key reset).
//
// Creates b2v-tp-* fixture rows only (admin, login attempts, rate-limit
// entries), cleans up after itself in `finally` even on unexpected errors.
// Development-local only — guarded by assertDestructiveScriptSafe().
import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import { assertDestructiveScriptSafe } from "./b2-guard.mts";

assertDestructiveScriptSafe("verify-trust-proxy.mts");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE = "http://localhost:3000";
const LIMIT = Number(process.env.LOGIN_RATE_LIMIT ?? 10);
const WINDOW = Number(process.env.LOGIN_RATE_WINDOW_SECONDS ?? 900);

const ADMIN_EMAIL = "b2v-tp-admin@wanderstory.test";
const ADMIN_PASS = "TpPass!2026";
const OK_EMAIL = ADMIN_EMAIL;
const EMAIL_LOCK_EMAIL = "b2v-tp-email@wanderstory.test";

const IP_T1 = "203.0.113.60";
const IP_T2_LIST = ["203.0.113.61", "203.0.113.62", "203.0.113.63"];
const IP_T3 = "203.0.113.77";
const IP_T5 = "203.0.113.99";

const IP_BLOCK_EMAILS = Array.from({ length: 11 }, (_, i) => `b2v-tp-ip${String(i + 1).padStart(2, "0")}@wanderstory.test`);

const FIXTURE_EMAILS = [OK_EMAIL, EMAIL_LOCK_EMAIL, ...IP_BLOCK_EMAILS];
const IP_FIXTURE_KEYS = [
  `login:ip:${IP_T1}`,
  ...IP_T2_LIST.map((ip) => `login:ip:${ip}`),
  `login:ip:${IP_T3}`,
  `login:ip:${IP_T5}`,
  ...Array.from({ length: 12 }, (_, i) => `login:ip:198.51.100.${i + 1}`),
];

let failures = 0;
function check(name: string, cond: boolean, detail: string) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " :: " + detail}`);
  if (!cond) failures += 1;
}

function windowStartFor(now: Date): Date {
  return new Date(Math.floor(now.getTime() / (WINDOW * 1000)) * (WINDOW * 1000));
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

async function loginAttempt(
  email: string,
  password: string,
  xff: string,
): Promise<{ loggedIn: boolean; status: number }> {
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
      "X-Forwarded-For": xff,
    },
    body: form,
  });
  jar = jarAdd(jar, res);
  return { loggedIn: jar.includes("authjs.session-token"), status: res.status };
}

async function countKey(key: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    SELECT "count" FROM "RateLimitEntry" WHERE "key" = ${key} AND "windowStart" = ${windowStartFor(new Date())};
  `;
  return rows[0]?.count ?? 0;
}

async function rateLimitedAudits(email: string): Promise<number> {
  return prisma.auditLog.count({
    where: { createdAt: { gte: RUN_SINCE }, eventType: "LOGIN_FAILED", actorEmail: email, metadata: { path: ["reason"], equals: "rate_limited" } },
  });
}

const RUN_SINCE = new Date();

try {
  await prisma.rateLimitEntry.deleteMany({ where: { key: { startsWith: "login:email:b2v-tp-" } } });
  await prisma.rateLimitEntry.deleteMany({ where: { key: { in: IP_FIXTURE_KEYS } } });
  await prisma.loginAttempt.deleteMany({ where: { email: { in: FIXTURE_EMAILS } } });
  await prisma.admin.deleteMany({ where: { id: "b2v-tp-admin" } });
  await prisma.admin.create({
    data: { id: "b2v-tp-admin", email: ADMIN_EMAIL, name: "43V TP Admin", role: "SUPER_ADMIN", passwordHash: await argon2.hash(ADMIN_PASS) },
  });

  // ===== T1. X-Forwarded-For trusted: IP rate-limit entries are created =====
  console.log("\n===== T1: IP entries created under TRUST_PROXY=1 =====");
  const t1 = await loginAttempt(OK_EMAIL, "wrong-password", IP_T1);
  check("T1 spoofed-XFF attempt permitted (fails, no session)", t1.loggedIn === false, `status=${t1.status}`);
  check("T1 IP entry created", (await countKey(`login:ip:${IP_T1}`)) === 1, "no login:ip entry — is the dev server running with TRUST_PROXY=1?");
  check("T1 email entry created", (await countKey(`login:email:${OK_EMAIL}`)) === 1, "email counter");

  // ===== T2. Different spoofed XFF values = different trusted client IPs =====
  console.log("\n===== T2: distinct spoofed XFF -> distinct IP counters =====");
  for (const ip of IP_T2_LIST) {
    const r = await loginAttempt(OK_EMAIL, "wrong-password", ip);
    check(`T2 attempt via ${ip} permitted`, r.loggedIn === false, `status=${r.status}`);
  }
  const t2Rows = await prisma.rateLimitEntry.findMany({ where: { key: { in: IP_T2_LIST.map((ip) => `login:ip:${ip}`) } } });
  check("T2 three distinct IP keys created",
    t2Rows.length === 3 && t2Rows.every((r) => r.count === 1),
    JSON.stringify(t2Rows.map((r) => [r.key, r.count])));

  // ===== T3. IP-keyed limit blocks while email counters stay under limit =====
  console.log("\n===== T3: IP-keyed block (11 emails, same XFF) =====");
  for (let i = 0; i < IP_BLOCK_EMAILS.length; i++) {
    const r = await loginAttempt(IP_BLOCK_EMAILS[i], "wrong-password", IP_T3);
    if (i < LIMIT) {
      check(`T3 attempt ${i + 1} permitted (email counter 1)`, r.loggedIn === false, `status=${r.status}`);
    } else {
      check(`T3 attempt ${i + 1} blocked by IP counter`, r.loggedIn === false, `status=${r.status}`);
    }
  }
  check("T3 IP counter reached limit+1 (11)", (await countKey(`login:ip:${IP_T3}`)) === LIMIT + 1, "IP counter");
  const t3EmailRows = await prisma.rateLimitEntry.findMany({ where: { key: { startsWith: "login:email:b2v-tp-ip" } } });
  check("T3 each email counter at 1 (all under limit)", t3EmailRows.length === 11 && t3EmailRows.every((r) => r.count === 1), JSON.stringify(t3EmailRows.map((r) => [r.key, r.count])));
  check("T3 11th attempt audited as rate_limited",
    (await rateLimitedAudits(IP_BLOCK_EMAILS[10])) === 1, "rate_limited audit for ip11");
  const t3FalsePositives = await prisma.auditLog.count({
    where: { eventType: "LOGIN_FAILED", actorEmail: { in: IP_BLOCK_EMAILS.slice(0, 10) } },
  });
  check("T3 no rate-limit false positives (attempts 1-10)", t3FalsePositives === 0, `count=${t3FalsePositives}`);

  // ===== T4. Email-keyed limiting still works under TRUST_PROXY=1 =====
  console.log("\n===== T4: email-keyed block (1 email, 12 distinct XFFs) =====");
  for (let i = 1; i <= 12; i++) {
    const r = await loginAttempt(EMAIL_LOCK_EMAIL, "wrong-password", `198.51.100.${i}`);
    if (i <= LIMIT) {
      check(`T4 attempt ${i} permitted`, r.loggedIn === false, `status=${r.status}`);
    } else {
      check(`T4 attempt ${i} blocked by email counter`, r.loggedIn === false, `status=${r.status}`);
    }
  }
  check("T4 email counter reached limit+2 (12)", (await countKey(`login:email:${EMAIL_LOCK_EMAIL}`)) === LIMIT + 2, "email counter");
  check("T4 blocked attempts audited as rate_limited (2)", (await rateLimitedAudits(EMAIL_LOCK_EMAIL)) === 2, "audits");
  const t4IpRows = await prisma.rateLimitEntry.findMany({ where: { key: { startsWith: "login:ip:198.51.100." } } });
  check("T4 distinct IP keys under limit (10, each count 1)",
    t4IpRows.length === LIMIT && t4IpRows.every((r) => r.count === 1),
    JSON.stringify(t4IpRows.length));

  // ===== T5. Legitimate login still succeeds; email key reset on success =====
  console.log("\n===== T5: positive control (correct login, fresh IP) =====");
  const t5 = await loginAttempt(OK_EMAIL, ADMIN_PASS, IP_T5);
  check("T5 correct login succeeds under TRUST_PROXY=1", t5.loggedIn === true, `status=${t5.status}`);
  check("T5 email key reset after success (0)", (await countKey(`login:email:${OK_EMAIL}`)) === 0, "email counter");
  check("T5 IP key still counted on success path (1)", (await countKey(`login:ip:${IP_T5}`)) === 1, "IP counter");
} catch (err) {
  failures += 1;
  console.error(
    "[verify-trust-proxy] Unexpected verification failure:",
    err instanceof Error ? err.message : String(err),
  );
} finally {
  await prisma.rateLimitEntry.deleteMany({ where: { key: { startsWith: "login:email:b2v-tp-" } } });
  await prisma.rateLimitEntry.deleteMany({ where: { key: { in: IP_FIXTURE_KEYS } } });
  await prisma.loginAttempt.deleteMany({ where: { email: { in: FIXTURE_EMAILS } } });
  await prisma.admin.deleteMany({ where: { id: "b2v-tp-admin" } });
  console.log("\n[verify-trust-proxy] fixture cleanup complete");
}

console.log(failures === 0 ? "\nALL_TP_CHECKS_PASSED" : `\nTP_VERIFICATION_FAILED (${failures} failed)`);
process.exit(failures === 0 ? 0 : 1);