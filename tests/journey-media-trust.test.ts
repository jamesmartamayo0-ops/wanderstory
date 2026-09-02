import assert from "node:assert/strict";
import { mock } from "node:test";
import test, { before, beforeEach } from "node:test";

type MediaRow = {
  id: string;
  provider: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
  url: string;
  mimeType: string;
};

const trustedMedia = (id: string): MediaRow => ({
  id,
  provider: "CLOUDINARY",
  type: "IMAGE",
  url: `https://res.cloudinary.com/wanderstory/image/upload/${id}.jpg`,
  mimeType: "image/jpeg",
});

let mediaRows: Map<string, MediaRow>;
let mediaQueries: Array<Record<string, unknown>>;
let createCount: number;
let updateCount: number;
let categoryDeleteCount: number;
let lastCreatedData: Record<string, unknown> | null;
let lastUpdatedData: Record<string, unknown> | null;

function resetState() {
  mediaRows = new Map();
  mediaQueries = [];
  createCount = 0;
  updateCount = 0;
  categoryDeleteCount = 0;
  lastCreatedData = null;
  lastUpdatedData = null;
}

function storeMedia(media: MediaRow): MediaRow {
  mediaRows.set(media.id, media);
  return media;
}

const transactionClient = {
  journeyCategory: {
    deleteMany: async () => {
      categoryDeleteCount += 1;
      return { count: 0 };
    },
    createMany: async () => ({ count: 1 }),
  },
  journey: {
    update: async ({ data }: { data: Record<string, unknown> }) => {
      updateCount += 1;
      lastUpdatedData = { ...data };
      return { id: "journey-1", ...data };
    },
  },
};

const prisma = {
  media: {
    findMany: async (arguments_: Record<string, unknown>) => {
      mediaQueries.push(arguments_);
      const where = arguments_.where as { id: { in: string[] } };
      return where.id.in.flatMap((id) => {
        const media = mediaRows.get(id);
        return media ? [media] : [];
      });
    },
  },
  journey: {
    findUnique: async ({ where }: { where: { id?: string; slug?: string } }) =>
      where.slug ? null : { publishedAt: null },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createCount += 1;
      lastCreatedData = { ...data };
      return { id: "journey-created", ...data };
    },
  },
  $transaction: async <T>(
    callback: (tx: typeof transactionClient) => Promise<T>,
  ) => callback(transactionClient),
};

type MockModule = (
  specifier: string,
  options: { exports: Record<string, unknown> },
) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);

mockModule("../lib/prisma", {
  exports: { default: prisma, prisma },
});
mockModule("../services/media.service", {
  exports: { purgeMediaAssets: async () => undefined },
});

let journeyService!: typeof import("../services/journey.service");
before(async () => {
  journeyService = await import("../services/journey.service");
});

beforeEach(resetState);

const createInput = {
  title: "Trusted Image Journey",
  travelerName: "A Traveler",
  travelStartDate: new Date("2026-08-01T00:00:00.000Z"),
  travelEndDate: new Date("2026-08-02T00:00:00.000Z"),
  introduction: "A journey with trusted images.",
  clientId: "client-1",
  destinationId: "destination-1",
  categoryIds: [],
  location: "Cebu",
  authorId: "admin-1",
};

test("valid Cloudinary IMAGE is accepted as coverMediaId", async () => {
  const media = storeMedia(trustedMedia("cover-image"));

  const result = await journeyService.updateJourney("journey-1", {
    coverMediaId: media.id,
  });

  assert.equal(result.success, true);
  assert.equal(lastUpdatedData?.coverMediaId, media.id);
});

test("valid Cloudinary IMAGE is accepted as ogImageId", async () => {
  const media = storeMedia({
    ...trustedMedia("og-image"),
    mimeType: "image/webp",
    url: "https://res.cloudinary.com/wanderstory/image/upload/og-image.webp",
  });

  const result = await journeyService.updateJourney("journey-1", {
    ogImageId: media.id,
  });

  assert.equal(result.success, true);
  assert.equal(lastUpdatedData?.ogImageId, media.id);
});

test("missing referenced Media is rejected", async () => {
  const result = await journeyService.updateJourney("journey-1", {
    coverMediaId: "missing-media",
  });

  assert.equal(result.success, false);
  assert.equal(updateCount, 0);
});

test("VIDEO is rejected for a journey image assignment", async () => {
  const media = storeMedia({
    ...trustedMedia("video"),
    type: "VIDEO",
    mimeType: "video/mp4",
  });

  const result = await journeyService.updateJourney("journey-1", {
    coverMediaId: media.id,
  });

  assert.equal(result.success, false);
  assert.equal(updateCount, 0);
});

test("DOCUMENT/PDF is rejected for a journey image assignment", async () => {
  const media = storeMedia({
    ...trustedMedia("document"),
    type: "DOCUMENT",
    mimeType: "application/pdf",
  });

  const result = await journeyService.updateJourney("journey-1", {
    ogImageId: media.id,
  });

  assert.equal(result.success, false);
  assert.equal(updateCount, 0);
});

test("provider mismatch is rejected", async () => {
  const media = storeMedia({
    ...trustedMedia("provider-mismatch"),
    provider: "EXTERNAL",
  });

  const result = await journeyService.updateJourney("journey-1", {
    coverMediaId: media.id,
  });

  assert.equal(result.success, false);
  assert.equal(updateCount, 0);
});

test("arbitrary external HTTPS image URL is rejected", async () => {
  const media = storeMedia({
    ...trustedMedia("external-origin"),
    url: "https://images.example/cover.jpg",
  });

  const result = await journeyService.updateJourney("journey-1", {
    ogImageId: media.id,
  });

  assert.equal(result.success, false);
  assert.equal(updateCount, 0);
});

test("HTTP Cloudinary-like URL is rejected", async () => {
  const media = storeMedia({
    ...trustedMedia("http-cloudinary"),
    url: "http://res.cloudinary.com/wanderstory/image/upload/cover.jpg",
  });

  const result = await journeyService.updateJourney("journey-1", {
    coverMediaId: media.id,
  });

  assert.equal(result.success, false);
  assert.equal(updateCount, 0);
});

test("malformed, data, and javascript URLs are rejected", async () => {
  for (const [index, url] of [
    "not a URL",
    "data:image/jpeg;base64,unsafe",
    "javascript:alert(1)",
    "https://user:password@res.cloudinary.com/wanderstory/image/upload/unsafe.jpg",
  ].entries()) {
    resetState();
    const media = storeMedia({ ...trustedMedia(`bad-url-${index}`), url });

    const result = await journeyService.updateJourney("journey-1", {
      coverMediaId: media.id,
    });

    assert.equal(result.success, false, url);
    assert.equal(updateCount, 0, url);
  }
});

test("non-image MIME is rejected even for an IMAGE row", async () => {
  const media = storeMedia({
    ...trustedMedia("bad-mime"),
    mimeType: "application/octet-stream",
  });

  const result = await journeyService.updateJourney("journey-1", {
    coverMediaId: media.id,
  });

  assert.equal(result.success, false);
  assert.equal(updateCount, 0);
});

test("null and unset image IDs preserve existing behavior without a Media query", async () => {
  const updateResult = await journeyService.updateJourney("journey-1", {
    coverMediaId: "",
    ogImageId: "",
  });
  const createResult = await journeyService.createJourney(createInput);

  assert.equal(updateResult.success, true);
  assert.equal(lastUpdatedData?.coverMediaId, null);
  assert.equal(lastUpdatedData?.ogImageId, null);
  assert.equal(createResult.success, true);
  assert.equal(mediaQueries.length, 0);
});

test("create path accepts trusted images and rejects an unsafe assignment", async () => {
  const media = storeMedia({
    ...trustedMedia("create-image"),
    mimeType: "image/png",
    url: "https://res.cloudinary.com/wanderstory/image/upload/create-image.png",
  });

  const validResult = await journeyService.createJourney({
    ...createInput,
    coverMediaId: media.id,
  });

  assert.equal(validResult.success, true);
  assert.equal(lastCreatedData?.coverMediaId, media.id);

  resetState();
  const unsafe = storeMedia({
    ...trustedMedia("unsafe-create-image"),
    provider: "local",
  });
  const invalidResult = await journeyService.createJourney({
    ...createInput,
    ogImageId: unsafe.id,
  });

  assert.equal(invalidResult.success, false);
  assert.equal(createCount, 0);
});

test("update path enforces the same trust contract", async () => {
  const trusted = storeMedia(trustedMedia("trusted-update"));
  const trustedResult = await journeyService.updateJourney("journey-1", {
    coverMediaId: trusted.id,
  });
  assert.equal(trustedResult.success, true);

  resetState();
  const unsafe = storeMedia({
    ...trustedMedia("unsafe-update"),
    url: "https://cdn.example/unsafe.jpg",
  });
  const unsafeResult = await journeyService.updateJourney("journey-1", {
    coverMediaId: unsafe.id,
  });

  assert.equal(unsafeResult.success, false);
  assert.equal(updateCount, 0);
});

test("one unsafe reference blocks both assignments before any transaction writes", async () => {
  const cover = storeMedia(trustedMedia("trusted-cover"));
  const ogImage = storeMedia({
    ...trustedMedia("unsafe-og"),
    url: "https://external.example/unsafe-og.jpg",
  });

  const result = await journeyService.updateJourney("journey-1", {
    coverMediaId: cover.id,
    ogImageId: ogImage.id,
    categoryIds: ["category-1"],
  });

  assert.equal(result.success, false);
  assert.equal(updateCount, 0);
  assert.equal(categoryDeleteCount, 0);
  assert.equal(mediaQueries.length, 1);
  const query = mediaQueries[0];
  assert.deepEqual(query.select, {
    id: true,
    provider: true,
    type: true,
    url: true,
    mimeType: true,
  });
});
