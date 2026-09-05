import assert from "node:assert/strict";
import { mock } from "node:test";
import test, { before, beforeEach } from "node:test";

type JourneyRow = {
  id: string;
  status: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "PRIVATE";
  publicationConsent: { consentGiven: boolean } | null;
};

type DraftRow = {
  id: string;
  journeyId: string;
  platform: "FACEBOOK" | "INSTAGRAM";
  caption: string;
  mediaId: string | null;
  status: "DRAFT" | "READY";
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MediaRow = {
  id: string;
  provider: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  url: string;
  mimeType: string;
  journeyId: string | null;
  chapter: { journeyId: string } | null;
  journeyCover: { id: string } | null;
  journeyOgImage: { id: string } | null;
};

let journeys: Map<string, JourneyRow>;
let drafts: Map<string, DraftRow>;
let mediaRows: Map<string, MediaRow>;
let nextDraftId: number;
let lastJourneyQuery: Record<string, unknown> | null;
let socialDraftCreateError: unknown;
let socialDraftRaceWinner: DraftRow | null;
let lastSocialDraftCreateData: Record<string, unknown> | null;
let socialDraftCalls: {
  findUnique: number;
  create: number;
  upsert: number;
  update: number;
  updateMany: number;
};

function copyDraft(row: DraftRow): DraftRow {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function resetState() {
  journeys = new Map([
    [
      "journey-1",
      {
        id: "journey-1",
        status: "APPROVED",
        visibility: "PRIVATE",
        publicationConsent: { consentGiven: false },
      },
    ],
    [
      "journey-2",
      {
        id: "journey-2",
        status: "APPROVED",
        visibility: "PUBLIC",
        publicationConsent: { consentGiven: true },
      },
    ],
  ]);
  drafts = new Map();
  mediaRows = new Map();
  nextDraftId = 1;
  lastJourneyQuery = null;
  socialDraftCreateError = null;
  socialDraftRaceWinner = null;
  lastSocialDraftCreateData = null;
  socialDraftCalls = {
    findUnique: 0,
    create: 0,
    upsert: 0,
    update: 0,
    updateMany: 0,
  };
}

function findDraft(journeyId: string, platform: DraftRow["platform"]) {
  return [...drafts.values()].find(
    (draft) => draft.journeyId === journeyId && draft.platform === platform,
  );
}

function storeDraft(overrides: Partial<DraftRow> = {}): DraftRow {
  const sequence = nextDraftId++;
  const row: DraftRow = {
    id: `draft-${sequence}`,
    journeyId: "journey-1",
    platform: "FACEBOOK",
    caption: "Caption",
    mediaId: null,
    status: "DRAFT",
    createdById: "admin-1",
    createdAt: new Date(`2026-09-03T00:00:0${sequence}.000Z`),
    updatedAt: new Date(`2026-09-03T00:00:0${sequence}.000Z`),
    ...overrides,
  };
  drafts.set(row.id, row);
  return row;
}

function trustedMedia(
  id: string,
  overrides: Partial<MediaRow> = {},
): MediaRow {
  return {
    id,
    provider: "CLOUDINARY",
    type: "IMAGE",
    url: `https://res.cloudinary.com/wanderstory/image/upload/${id}.jpg`,
    mimeType: "image/jpeg",
    journeyId: null,
    chapter: null,
    journeyCover: null,
    journeyOgImage: null,
    ...overrides,
  };
}

const prisma = {
  journey: {
    findUnique: async (arguments_: {
      where: { id: string };
      select?: Record<string, unknown>;
    }) => {
      lastJourneyQuery = arguments_;
      return journeys.get(arguments_.where.id) ?? null;
    },
  },
  media: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      mediaRows.get(where.id) ?? null,
  },
  socialDraft: {
    findMany: async ({ where }: { where: { journeyId: string } }) =>
      [...drafts.values()]
        .filter((draft) => draft.journeyId === where.journeyId)
        .sort((left, right) => left.platform.localeCompare(right.platform))
        .map(copyDraft),
    findUnique: async ({
      where,
    }: {
      where: {
        journeyId_platform: {
          journeyId: string;
          platform: DraftRow["platform"];
        };
      };
    }) => {
      socialDraftCalls.findUnique += 1;
      const key = where.journeyId_platform;
      const draft = findDraft(key.journeyId, key.platform);
      return draft ? copyDraft(draft) : null;
    },
    findFirst: async ({
      where,
    }: {
      where: { id: string; journeyId: string };
    }) => {
      const draft = drafts.get(where.id);
      return draft?.journeyId === where.journeyId ? copyDraft(draft) : null;
    },
    create: async ({
      data,
    }: {
      data: {
        journeyId: string;
        platform: DraftRow["platform"];
        caption: string;
        mediaId: string | null;
        createdById: string;
      };
    }) => {
      socialDraftCalls.create += 1;
      lastSocialDraftCreateData = { ...data };

      if (socialDraftCreateError) {
        if (socialDraftRaceWinner) {
          drafts.set(socialDraftRaceWinner.id, socialDraftRaceWinner);
        }
        throw socialDraftCreateError;
      }

      return copyDraft(
        storeDraft({
          journeyId: data.journeyId,
          platform: data.platform,
          caption: data.caption,
          mediaId: data.mediaId,
          createdById: data.createdById,
        }),
      );
    },
    upsert: async () => {
      socialDraftCalls.upsert += 1;
      throw new Error("Unexpected SocialDraft upsert");
    },
    update: async () => {
      socialDraftCalls.update += 1;
      throw new Error("Unexpected SocialDraft update");
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: {
        id: string;
        journeyId: string;
        updatedAt: Date;
        status: DraftRow["status"];
      };
      data: Partial<Pick<DraftRow, "caption" | "mediaId" | "status">>;
    }) => {
      socialDraftCalls.updateMany += 1;
      const draft = drafts.get(where.id);
      if (
        !draft ||
        draft.journeyId !== where.journeyId ||
        draft.updatedAt.getTime() !== where.updatedAt.getTime() ||
        draft.status !== where.status
      ) {
        return { count: 0 };
      }

      Object.assign(draft, data);
      draft.updatedAt = new Date(draft.updatedAt.getTime() + 1000);
      return { count: 1 };
    },
    deleteMany: async ({
      where,
    }: {
      where: { id: string; journeyId: string };
    }) => {
      const draft = drafts.get(where.id);
      if (!draft || draft.journeyId !== where.journeyId) {
        return { count: 0 };
      }
      drafts.delete(draft.id);
      return { count: 1 };
    },
  },
};

type MockModule = (
  specifier: string,
  options: { exports: Record<string, unknown> },
) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);

mockModule("../lib/prisma", {
  exports: { default: prisma, prisma },
});

let service!: typeof import("../services/social-draft.service");
before(async () => {
  service = await import("../services/social-draft.service");
});

beforeEach(resetState);

test("existing draft is returned unchanged without any create or update call", async () => {
  const updatedAt = new Date("2026-09-03T12:00:00.000Z");
  const existing = storeDraft({
    caption: "Original",
    mediaId: "original-media",
    status: "DRAFT",
    createdById: "admin-a",
    updatedAt,
  });

  const result = await service.createSocialDraft(
    {
      journeyId: "journey-1",
      platform: "FACEBOOK",
      caption: "Replacement caption",
      mediaId: null,
    },
    "admin-b",
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.id, existing.id);
    assert.equal(result.data.caption, "Original");
    assert.equal(result.data.mediaId, "original-media");
    assert.equal(result.data.status, "DRAFT");
    assert.equal(result.data.createdById, "admin-a");
    assert.equal(result.data.updatedAt.getTime(), updatedAt.getTime());
  }
  assert.equal(drafts.get(existing.id)?.caption, "Original");
  assert.equal(drafts.get(existing.id)?.mediaId, "original-media");
  assert.equal(drafts.get(existing.id)?.createdById, "admin-a");
  assert.equal(drafts.get(existing.id)?.updatedAt.getTime(), updatedAt.getTime());
  assert.deepEqual(socialDraftCalls, {
    findUnique: 1,
    create: 0,
    upsert: 0,
    update: 0,
    updateMany: 0,
  });
});

test("missing draft is created once with explicit caller-derived data and no update", async () => {
  const result = await service.createSocialDraft(
    {
      journeyId: "journey-1",
      platform: "FACEBOOK",
      caption: "Created caption",
    },
    "admin-a",
  );

  assert.equal(result.success, true);
  assert.deepEqual(lastSocialDraftCreateData, {
    journeyId: "journey-1",
    platform: "FACEBOOK",
    caption: "Created caption",
    mediaId: null,
    createdById: "admin-a",
  });
  assert.equal(drafts.size, 1);
  assert.deepEqual(socialDraftCalls, {
    findUnique: 1,
    create: 1,
    upsert: 0,
    update: 0,
    updateMany: 0,
  });
});

test("Prisma 7 adapter P2002 with a quoted journeyId re-fetches the unchanged winner", async () => {
  const winnerUpdatedAt = new Date("2026-09-03T12:00:00.000Z");
  const winner = storeDraft({
    caption: "Winner caption",
    mediaId: "winner-media",
    createdById: "admin-a",
    updatedAt: new Date(winnerUpdatedAt),
  });
  drafts.delete(winner.id);
  socialDraftRaceWinner = winner;
  socialDraftCreateError = {
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

  const result = await service.createSocialDraft(
    {
      journeyId: "journey-1",
      platform: "FACEBOOK",
      caption: "Losing caption",
    },
    "admin-b",
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.id, winner.id);
    assert.equal(result.data.caption, "Winner caption");
    assert.equal(result.data.mediaId, "winner-media");
    assert.equal(result.data.createdById, "admin-a");
    assert.equal(result.data.updatedAt.getTime(), winnerUpdatedAt.getTime());
  }
  assert.equal(drafts.get(winner.id)?.caption, "Winner caption");
  assert.equal(drafts.get(winner.id)?.createdById, "admin-a");
  assert.equal(drafts.get(winner.id)?.updatedAt.getTime(), winnerUpdatedAt.getTime());
  assert.deepEqual(socialDraftCalls, {
    findUnique: 2,
    create: 1,
    upsert: 0,
    update: 0,
    updateMany: 0,
  });
});

function adapterUniqueError(
  fields: unknown = ['"journeyId"', "platform"],
  modelName: unknown = "SocialDraft",
  kind: unknown = "UniqueConstraintViolation",
) {
  return {
    code: "P2002",
    meta: {
      modelName,
      driverAdapterError: { cause: { kind, constraint: { fields } } },
    },
  };
}

const compatibleUniqueErrors = [
  {
    name: "legacy target array",
    error: { code: "P2002", meta: { target: ["journeyId", "platform"] } },
  },
  {
    name: "legacy compound target string",
    error: { code: "P2002", meta: { target: "journeyId_platform" } },
  },
  {
    name: "legacy constraint target string",
    error: {
      code: "P2002",
      meta: { target: "SocialDraft_journeyId_platform_key" },
    },
  },
  {
    name: "adapter unquoted fields",
    error: adapterUniqueError(["journeyId", "platform"]),
  },
  {
    name: "adapter both fields quoted",
    error: adapterUniqueError(['"journeyId"', '"platform"']),
  },
  {
    name: "adapter fields in reverse order",
    error: adapterUniqueError(['"platform"', '"journeyId"']),
  },
];

for (const { name, error } of compatibleUniqueErrors) {
  test(`P2002 recovery supports ${name}`, async () => {
    const winner = storeDraft({ caption: "Winner caption", createdById: "admin-a" });
    const expected = copyDraft(winner);
    drafts.delete(winner.id);
    socialDraftRaceWinner = winner;
    socialDraftCreateError = error;

    const result = await service.createSocialDraft(
      { journeyId: "journey-1", platform: "FACEBOOK", caption: "Losing caption" },
      "admin-b",
    );

    assert.deepEqual(result, { success: true, data: expected });
    assert.deepEqual(drafts.get(winner.id), expected);
    assert.deepEqual(socialDraftCalls, {
      findUnique: 2,
      create: 1,
      upsert: 0,
      update: 0,
      updateMany: 0,
    });
  });
}

const unrelatedAdapterErrors = [
  { name: "wrong model", error: adapterUniqueError(undefined, "Media") },
  { name: "missing model", error: adapterUniqueError(undefined, null) },
  {
    name: "wrong kind",
    error: adapterUniqueError(undefined, "SocialDraft", "ForeignKeyConstraintViolation"),
  },
  { name: "missing kind", error: adapterUniqueError(undefined, "SocialDraft", null) },
  ...[
    ["id"],
    ["journeyId"],
    ["platform"],
    ["journeyId", "other"],
    ["journeyId", "platform", "extra"],
    ["journeyId", "journeyId"],
    ["platform", "platform"],
    ["'journeyId'", "platform"],
    ["`journeyId`", "platform"],
    ["[journeyId]", "platform"],
    ['"journeyId', "platform"],
    ['journeyId"', "platform"],
    ['""journeyId""', "platform"],
    [" journeyId ", "platform"],
    ["journeyId", 1],
    ["journeyId", null],
    ["journeyId", { name: "platform" }],
    null,
    "journeyId_platform",
  ].map((fields) => ({
    name: `invalid fields ${JSON.stringify(fields)}`,
    error: adapterUniqueError(fields),
  })),
  ...[
    undefined,
    null,
    [],
    {},
    { modelName: "SocialDraft", driverAdapterError: null },
    { modelName: "SocialDraft", driverAdapterError: [] },
    { modelName: "SocialDraft", driverAdapterError: {} },
    { modelName: "SocialDraft", driverAdapterError: { cause: null } },
    { modelName: "SocialDraft", driverAdapterError: { cause: [] } },
    {
      modelName: "SocialDraft",
      driverAdapterError: { cause: { kind: "UniqueConstraintViolation", constraint: null } },
    },
    {
      modelName: "SocialDraft",
      driverAdapterError: { cause: { kind: "UniqueConstraintViolation", constraint: {} } },
    },
  ].map((meta) => ({
    name: `malformed metadata ${JSON.stringify(meta)}`,
    error: { code: "P2002", meta },
  })),
  {
    name: "non-P2002 code with otherwise matching adapter metadata",
    error: { ...adapterUniqueError(), code: "P2003" },
  },
];

for (const { name, error } of unrelatedAdapterErrors) {
  test(`adapter error with ${name} fails without winner recovery`, async () => {
    const winner = storeDraft();
    const expected = copyDraft(winner);
    drafts.delete(winner.id);
    socialDraftRaceWinner = winner;
    socialDraftCreateError = error;

    const result = await service.createSocialDraft(
      { journeyId: "journey-1", platform: "FACEBOOK", caption: "Losing caption" },
      "admin-b",
    );

    assert.deepEqual(result, {
      success: false,
      code: "OPERATION_FAILED",
      error: "Failed to create social draft",
    });
    assert.deepEqual(drafts.get(winner.id), expected);
    assert.deepEqual(socialDraftCalls, {
      findUnique: 1,
      create: 1,
      upsert: 0,
      update: 0,
      updateMany: 0,
    });
  });
}

test("Prisma 7 adapter P2002 without a readable winner fails safely", async () => {
  socialDraftCreateError = adapterUniqueError();

  const result = await service.createSocialDraft(
    { journeyId: "journey-1", platform: "FACEBOOK", caption: "Caption" },
    "admin-a",
  );

  assert.deepEqual(result, {
    success: false,
    code: "OPERATION_FAILED",
    error: "Failed to create social draft",
  });
  assert.deepEqual(socialDraftCalls, {
    findUnique: 2,
    create: 1,
    upsert: 0,
    update: 0,
    updateMany: 0,
  });
});

test("non-P2002 create failure is controlled and does not fetch a winner", async () => {
  socialDraftCreateError = new Error("database unavailable");

  const result = await service.createSocialDraft(
    { journeyId: "journey-1", platform: "FACEBOOK", caption: "Caption" },
    "admin-a",
  );

  assert.deepEqual(result, {
    success: false,
    code: "OPERATION_FAILED",
    error: "Failed to create social draft",
  });
  assert.deepEqual(socialDraftCalls, {
    findUnique: 1,
    create: 1,
    upsert: 0,
    update: 0,
    updateMany: 0,
  });
});

test("P2002 for another constraint is not treated as the compound-key race", async () => {
  socialDraftCreateError = {
    code: "P2002",
    meta: { target: ["id"] },
  };

  const result = await service.createSocialDraft(
    { journeyId: "journey-1", platform: "FACEBOOK", caption: "Caption" },
    "admin-a",
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "OPERATION_FAILED");
  assert.equal(socialDraftCalls.findUnique, 1);
  assert.equal(socialDraftCalls.create, 1);
});

test("archived Journey mutations are rejected", async () => {
  journeys.set("journey-1", {
    ...journeys.get("journey-1")!,
    status: "ARCHIVED",
  });

  const result = await service.createSocialDraft(
    { journeyId: "journey-1", platform: "FACEBOOK", caption: "Caption" },
    "admin-1",
  );

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "ALREADY_ARCHIVED");
  assert.equal(drafts.size, 0);
});

test("archived Journey rejects update, status transition, and delete", async () => {
  const draft = storeDraft();
  journeys.set("journey-1", {
    ...journeys.get("journey-1")!,
    status: "ARCHIVED",
  });

  const update = await service.updateSocialDraft({
    journeyId: draft.journeyId,
    draftId: draft.id,
    caption: "Changed",
    updatedAt: draft.updatedAt,
  });
  const transition = await service.transitionSocialDraftStatus({
    journeyId: draft.journeyId,
    draftId: draft.id,
    targetStatus: "READY",
    updatedAt: draft.updatedAt,
  });
  const deletion = await service.deleteSocialDraft({
    journeyId: draft.journeyId,
    draftId: draft.id,
  });

  for (const result of [update, transition, deletion]) {
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.code, "ALREADY_ARCHIVED");
  }
  assert.equal(drafts.has(draft.id), true);
  assert.equal(socialDraftCalls.update, 0);
  assert.equal(socialDraftCalls.updateMany, 0);
});

test("trusted direct, Chapter, cover, and OG Media associations are accepted", async () => {
  const associations: Array<Partial<MediaRow>> = [
    { journeyId: "journey-1" },
    { chapter: { journeyId: "journey-1" } },
    { journeyCover: { id: "journey-1" } },
    { journeyOgImage: { id: "journey-1" } },
  ];

  for (const [index, association] of associations.entries()) {
    resetState();
    const media = trustedMedia(`accepted-${index}`, association);
    mediaRows.set(media.id, media);

    const result = await service.createSocialDraft(
      {
        journeyId: "journey-1",
        platform: "FACEBOOK",
        caption: "Caption",
        mediaId: media.id,
      },
      "admin-1",
    );

    assert.equal(result.success, true, JSON.stringify(association));
  }
});

test("foreign, unattached, destination-only, and unsafe Media are rejected", async () => {
  const rejected: MediaRow[] = [
    trustedMedia("other-journey", { journeyId: "journey-2" }),
    trustedMedia("other-chapter", { chapter: { journeyId: "journey-2" } }),
    trustedMedia("generic-unattached"),
    trustedMedia("destination-only"),
    trustedMedia("provider", {
      journeyId: "journey-1",
      provider: "EXTERNAL",
    }),
    trustedMedia("mime", {
      journeyId: "journey-1",
      mimeType: "image/svg+xml",
    }),
    trustedMedia("url", {
      journeyId: "journey-1",
      url: "https://images.example/unsafe.jpg",
    }),
    trustedMedia("video", {
      journeyId: "journey-1",
      type: "VIDEO",
      mimeType: "video/mp4",
    }),
    trustedMedia("document", {
      journeyId: "journey-1",
      type: "DOCUMENT",
      mimeType: "application/pdf",
    }),
  ];

  for (const media of rejected) {
    resetState();
    mediaRows.set(media.id, media);
    const result = await service.createSocialDraft(
      {
        journeyId: "journey-1",
        platform: "FACEBOOK",
        caption: "Caption",
        mediaId: media.id,
      },
      "admin-1",
    );

    assert.equal(result.success, false, media.id);
    if (!result.success) assert.equal(result.code, "INVALID_MEDIA", media.id);
    assert.equal(drafts.size, 0, media.id);
  }
});

test("DRAFT update is scoped by Journey and succeeds with the loaded timestamp", async () => {
  const draft = storeDraft();
  const originalUpdatedAt = new Date(draft.updatedAt);
  const result = await service.updateSocialDraft({
    journeyId: "journey-1",
    draftId: draft.id,
    caption: "  Updated\r\ncaption  ",
    updatedAt: originalUpdatedAt,
  });

  assert.equal(result.success, true);
  assert.equal(drafts.get(draft.id)?.caption, "Updated\ncaption");
  assert.notEqual(drafts.get(draft.id)?.updatedAt.getTime(), originalUpdatedAt.getTime());
});

test("cross-Journey update is NOT_FOUND and does not leak or mutate the draft", async () => {
  const draft = storeDraft({ journeyId: "journey-2" });
  const result = await service.updateSocialDraft({
    journeyId: "journey-1",
    draftId: draft.id,
    caption: "Attack",
    updatedAt: draft.updatedAt,
  });

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "NOT_FOUND");
  assert.equal(drafts.get(draft.id)?.caption, "Caption");
});

test("READY content cannot be edited until reverted", async () => {
  const draft = storeDraft({ status: "READY" });
  const result = await service.updateSocialDraft({
    journeyId: draft.journeyId,
    draftId: draft.id,
    caption: "Changed",
    updatedAt: draft.updatedAt,
  });

  assert.equal(result.success, false);
  if (!result.success) assert.equal(result.code, "READY_LOCKED");
  assert.equal(drafts.get(draft.id)?.caption, "Caption");
});

test("stale update is CONFLICT while absent or wrong-Journey update is NOT_FOUND", async () => {
  const draft = storeDraft();
  const stale = await service.updateSocialDraft({
    journeyId: draft.journeyId,
    draftId: draft.id,
    caption: "Stale",
    updatedAt: new Date(draft.updatedAt.getTime() - 1000),
  });
  const absent = await service.updateSocialDraft({
    journeyId: draft.journeyId,
    draftId: "missing",
    caption: "Missing",
    updatedAt: draft.updatedAt,
  });

  assert.equal(stale.success, false);
  if (!stale.success) assert.equal(stale.code, "CONFLICT");
  assert.equal(absent.success, false);
  if (!absent.success) assert.equal(absent.code, "NOT_FOUND");
});

test("DRAFT transitions to READY and READY explicitly reverts to DRAFT", async () => {
  const draft = storeDraft();
  const ready = await service.transitionSocialDraftStatus({
    journeyId: draft.journeyId,
    draftId: draft.id,
    targetStatus: "READY",
    updatedAt: draft.updatedAt,
  });

  assert.equal(ready.success, true);
  assert.equal(drafts.get(draft.id)?.status, "READY");

  const current = drafts.get(draft.id)!;
  const reverted = await service.transitionSocialDraftStatus({
    journeyId: current.journeyId,
    draftId: current.id,
    targetStatus: "DRAFT",
    updatedAt: current.updatedAt,
  });

  assert.equal(reverted.success, true);
  assert.equal(drafts.get(draft.id)?.status, "DRAFT");
});

test("DRAFT or REVIEW Journey cannot mark a SocialDraft READY", async () => {
  for (const status of ["DRAFT", "REVIEW"] as const) {
    resetState();
    journeys.set("journey-1", { ...journeys.get("journey-1")!, status });
    const draft = storeDraft();
    const result = await service.transitionSocialDraftStatus({
      journeyId: draft.journeyId,
      draftId: draft.id,
      targetStatus: "READY",
      updatedAt: draft.updatedAt,
    });

    assert.equal(result.success, false, status);
    if (!result.success) assert.equal(result.code, "EDITORIAL_INCOMPLETE", status);
  }
});

test("Instagram READY requires a persisted trusted same-Journey image", async () => {
  const missingMediaDraft = storeDraft({ platform: "INSTAGRAM" });
  const missing = await service.transitionSocialDraftStatus({
    journeyId: missingMediaDraft.journeyId,
    draftId: missingMediaDraft.id,
    targetStatus: "READY",
    updatedAt: missingMediaDraft.updatedAt,
  });
  assert.equal(missing.success, false);
  if (!missing.success) assert.equal(missing.code, "EDITORIAL_INCOMPLETE");

  resetState();
  const media = trustedMedia("instagram-image", { journeyId: "journey-1" });
  mediaRows.set(media.id, media);
  const trustedDraft = storeDraft({
    platform: "INSTAGRAM",
    mediaId: media.id,
  });
  const trusted = await service.transitionSocialDraftStatus({
    journeyId: trustedDraft.journeyId,
    draftId: trustedDraft.id,
    targetStatus: "READY",
    updatedAt: trustedDraft.updatedAt,
  });

  assert.equal(trusted.success, true);
});

test("delete is scoped by Journey", async () => {
  const draft = storeDraft({ journeyId: "journey-2", status: "READY" });
  const denied = await service.deleteSocialDraft({
    journeyId: "journey-1",
    draftId: draft.id,
  });
  assert.equal(denied.success, false);
  if (!denied.success) assert.equal(denied.code, "NOT_FOUND");

  const deleted = await service.deleteSocialDraft({
    journeyId: "journey-2",
    draftId: draft.id,
  });
  assert.equal(deleted.success, true);
  assert.equal(drafts.has(draft.id), false);
});

test("eligibility DTO uses scoped data and the Journey query does not select privateToken", async () => {
  const draft = storeDraft({ status: "READY" });
  const result = await service.getSocialDraftEligibility(
    draft.journeyId,
    draft.id,
    true,
  );

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.editorialStatus, "READY");
    assert.equal(result.data.eligibility.eligible, false);
    assert.deepEqual(result.data.eligibility.reasons, [
      "JOURNEY_NOT_PUBLISHED",
      "JOURNEY_NOT_PUBLIC",
      "PUBLICATION_CONSENT_MISSING",
    ]);
  }
  const select = lastJourneyQuery?.select as Record<string, unknown>;
  assert.equal(Object.hasOwn(select, "privateToken"), false);
  assert.equal(Object.hasOwn(select, "canonicalUrl"), false);
});
