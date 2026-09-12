import assert from "node:assert/strict";
import test, { before, beforeEach, mock } from "node:test";
import type { SerializedSocialDraft } from "../types/social-draft";

type Draft = Omit<SerializedSocialDraft, "createdAt" | "updatedAt"> & {
  createdAt: Date;
  updatedAt: Date;
};
const input = { journeyId: "journey-1", platform: "FACEBOOK", caption: "New caption" };
const adapterError = {
  code: "P2002",
  meta: {
    modelName: "SocialDraft",
    driverAdapterError: {
      cause: {
        kind: "UniqueConstraintViolation",
        constraint: { fields: ['"journeyId"', "platform"] },
      },
    },
  },
};
function draft(): Draft {
  return {
    id: "draft-1", journeyId: "journey-1", platform: "FACEBOOK",
    caption: "Winner caption", mediaId: "winner-image", status: "READY",
    createdById: "winner-actor", createdAt: new Date("2026-09-03T00:00:00Z"),
    updatedAt: new Date("2026-09-03T12:00:00Z"),
  };
}
let stored: Draft | null;
let raceWinner: Draft | null;
let createError: unknown;
let counts: Record<"findUnique" | "create" | "upsert" | "update" | "updateMany" | "media" | "journey", number>;
const prisma = {
  journey: {
    findUnique: async () => {
      counts.journey++;
      return { id: "journey-1", status: "APPROVED" };
    },
  },
  media: { findUnique: async () => { counts.media++; return null; } },
  socialDraft: {
    findUnique: async () => { counts.findUnique++; return stored && structuredClone(stored); },
    create: async ({ data }: { data: Pick<Draft, "journeyId" | "platform" | "caption" | "mediaId" | "createdById"> }) => {
      counts.create++;
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (createError) {
        stored = raceWinner && structuredClone(raceWinner);
        throw createError;
      }
      if (stored) throw adapterError;
      stored = { ...draft(), ...data, status: "DRAFT" };
      return structuredClone(stored);
    },
    upsert: async () => { counts.upsert++; throw new Error("Unexpected upsert"); },
    update: async () => { counts.update++; throw new Error("Unexpected update"); },
    updateMany: async () => { counts.updateMany++; throw new Error("Unexpected updateMany"); },
  },
};
type MockModule = (specifier: string, options: { exports: Record<string, unknown> }) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);
mockModule("../lib/prisma", { exports: { default: prisma, prisma } });
let service!: typeof import("../services/social-draft.service");
before(async () => { service = await import("../services/social-draft.service"); });
beforeEach(() => {
  stored = null;
  raceWinner = null;
  createError = null;
  counts = { findUnique: 0, create: 0, upsert: 0, update: 0, updateMany: 0, media: 0, journey: 0 };
});

test("new insert reports created=true and preserves authenticated creator data", async () => {
  const result = await service.createSocialDraftWithOutcome(input, "actor-1");
  assert.ok(result.success);
  assert.equal(result.data.created, true);
  assert.equal(result.data.draft.createdById, "actor-1");
  assert.equal(result.data.draft.caption, input.caption);
  assert.equal(counts.create, 1);
});

test("initial existing row reports false with unchanged timestamp and zero writes or media validation", async () => {
  stored = draft();
  const expected = structuredClone(stored);
  const result = await service.createSocialDraftWithOutcome({ ...input, mediaId: "unassignable" }, "actor-2");
  assert.deepEqual(result, { success: true, data: { draft: expected, created: false } });
  assert.deepEqual(stored, expected);
  assert.deepEqual(counts, {
    findUnique: 1, create: 0, upsert: 0, update: 0, updateMany: 0, media: 0, journey: 1,
  });
});

for (const [name, error] of [
  ["Prisma 7 adapter", adapterError],
  ["legacy target array", { code: "P2002", meta: { target: ["journeyId", "platform"] } }],
  ["legacy compound target", { code: "P2002", meta: { target: "journeyId_platform" } }],
  ["legacy constraint target", { code: "P2002", meta: { target: "SocialDraft_journeyId_platform_key" } }],
] as const) {
  test(`${name} race reports false and returns every winner field unchanged`, async () => {
    createError = error;
    raceWinner = draft();
    const expected = structuredClone(raceWinner);
    const result = await service.createSocialDraftWithOutcome(input, "loser-actor");
    assert.deepEqual(result, { success: true, data: { draft: expected, created: false } });
    assert.deepEqual(stored, expected);
    assert.equal(counts.findUnique, 2);
    assert.equal(counts.create, 1);
    assert.equal(counts.upsert + counts.update + counts.updateMany, 0);
  });
}

for (const [name, error, reads] of [
  ["expected P2002 without winner", adapterError, 2],
  ["unrelated P2002", { code: "P2002", meta: { target: ["id"] } }, 1],
  ["non-P2002", new Error("secret database details"), 1],
] as const) {
  test(`${name} returns controlled failure with the correct recovery reads`, async () => {
    createError = error;
    const result = await service.createSocialDraftWithOutcome(input, "actor-1");
    assert.deepEqual(result, {
      success: false, code: "OPERATION_FAILED", error: "Failed to create social draft",
    });
    assert.equal(counts.findUnique, reads);
    assert.equal(counts.create, 1);
  });
}

for (const branch of ["insert", "existing", "race"] as const) {
  test(`legacy create preserves its exact public success shape for ${branch}`, async () => {
    if (branch === "existing") stored = draft();
    if (branch === "race") { createError = adapterError; raceWinner = draft(); }
    const result = await service.createSocialDraft(input, "actor-1");
    assert.deepEqual(result, { success: true, data: stored });
    assert.ok(result.success);
    assert.equal("created" in result.data, false);
    assert.equal("draft" in result.data, false);
  });
}

test("two concurrent creates converge with one true outcome and an unchanged winner", async () => {
  const results = await Promise.all([
    service.createSocialDraftWithOutcome(input, "actor-a"),
    service.createSocialDraftWithOutcome({ ...input, caption: "Loser caption" }, "actor-b"),
  ]);
  const [first, second] = results;
  assert.ok(first.success && second.success);
  assert.equal(first.data.created, true);
  assert.equal(second.data.created, false);
  assert.deepEqual(second.data.draft, first.data.draft);
  assert.equal(first.data.draft.caption, input.caption);
  assert.equal(first.data.draft.createdById, "actor-a");
  assert.deepEqual(stored, first.data.draft);
  assert.equal(counts.findUnique, 3);
  assert.equal(counts.create, 2);
  assert.equal(counts.upsert + counts.update + counts.updateMany, 0);
});

test("outcome API keeps validation before Journey access and media checks before missing-row insertion", async () => {
  const invalid = await service.createSocialDraftWithOutcome({ ...input, platform: "FORGED" }, "actor-1");
  assert.ok(!invalid.success);
  assert.equal(invalid.code, "VALIDATION_ERROR");
  assert.equal(counts.journey, 0);
  const invalidMedia = await service.createSocialDraftWithOutcome({ ...input, mediaId: "foreign" }, "actor-1");
  assert.ok(!invalidMedia.success);
  assert.equal(invalidMedia.code, "INVALID_MEDIA");
  assert.equal(counts.media, 1);
  assert.equal(counts.create, 0);
});
