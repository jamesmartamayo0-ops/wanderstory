import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(
  join(
    root,
    "prisma",
    "migrations",
    "20260903000000_add_social_drafts",
    "migration.sql",
  ),
  "utf8",
);
const service = readFileSync(
  join(root, "services", "social-draft.service.ts"),
  "utf8",
);
const permissions = readFileSync(
  join(root, "lib", "permissions.ts"),
  "utf8",
);

function modelBlock(name: string): string {
  const start = schema.indexOf(`model ${name} {`);
  assert.notEqual(start, -1, `${name} model missing`);
  const end = schema.indexOf("\n}\n", start);
  assert.notEqual(end, -1, `${name} model is incomplete`);
  return schema.slice(start, end + 2);
}

test("SocialDraft schema freezes one Journey/platform draft and required relations", () => {
  const socialDraft = modelBlock("SocialDraft");

  assert.match(socialDraft, /@@unique\(\[journeyId, platform\]\)/);
  assert.match(socialDraft, /@@index\(\[status, updatedAt\]\)/);
  assert.match(socialDraft, /@@index\(\[mediaId\]\)/);
  assert.match(
    socialDraft,
    /journey\s+Journey\s+@relation\(fields: \[journeyId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(
    socialDraft,
    /media\s+Media\?\s+@relation\(fields: \[mediaId\], references: \[id\], onDelete: SetNull\)/,
  );
  assert.match(
    socialDraft,
    /createdBy\s+Admin\?\s+@relation\(fields: \[createdById\], references: \[id\], onDelete: SetNull\)/,
  );
});

test("migration contains enums, audit values, table, foreign keys, and indexes", () => {
  for (const expected of [
    `CREATE TYPE "SocialPlatform" AS ENUM ('FACEBOOK', 'INSTAGRAM')`,
    `CREATE TYPE "SocialDraftStatus" AS ENUM ('DRAFT', 'READY')`,
    `SOCIAL_DRAFT_CREATED`,
    `SOCIAL_DRAFT_UPDATED`,
    `SOCIAL_DRAFT_DELETED`,
    `SOCIAL_DRAFT_STATUS_CHANGED`,
    `CREATE TABLE "SocialDraft"`,
    `ON DELETE CASCADE ON UPDATE CASCADE`,
    `SocialDraft_mediaId_fkey`,
    `SocialDraft_createdById_fkey`,
    `ON DELETE SET NULL ON UPDATE CASCADE`,
    `SocialDraft_status_updatedAt_idx`,
    `SocialDraft_mediaId_idx`,
    `SocialDraft_journeyId_platform_key`,
  ]) {
    assert.equal(migration.includes(expected), true, expected);
  }
});

test("SocialDraft persistence contains no publishing, account, token, URL, scheduling, or AI fields", () => {
  const socialDraft = modelBlock("SocialDraft").toLowerCase();
  for (const forbidden of [
    "oauth",
    "account",
    "token",
    "publishable",
    "publisheligibility",
    "scheduled",
    "retry",
    "analytics",
    "publicurl",
    "canonicalurl",
    "hashtag",
    "prompt",
    "llm",
  ]) {
    assert.equal(socialDraft.includes(forbidden), false, forbidden);
  }
});

test("service does not query or construct privateToken, canonicalUrl, or origin values", () => {
  for (const forbidden of [
    "privateToken",
    "canonicalUrl",
    "window.location",
    "x-forwarded-host",
    "VERCEL_URL",
  ]) {
    assert.equal(service.includes(forbidden), false, forbidden);
  }
});

test("permission boundary contains only the four approved SocialDraft verbs", () => {
  const socialPermissionLines = permissions
    .split(/\r?\n/)
    .filter((line) => line.includes('"social:'));

  assert.deepEqual(socialPermissionLines.map((line) => line.trim()), [
    '"social:create": ["SUPER_ADMIN", "EDITOR"],',
    '"social:update": ["SUPER_ADMIN", "EDITOR"],',
    '"social:ready": ["SUPER_ADMIN", "EDITOR"],',
    '"social:delete": ["SUPER_ADMIN"],',
  ]);
});
