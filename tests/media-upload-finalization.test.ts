import assert from "node:assert/strict";
import { mock } from "node:test";
import test, { before } from "node:test";
import type { MediaUploadAuthorization } from "../lib/validation/media-upload.schema";
import type { AuthoritativeProviderResource } from "../services/storage/storage.types";

type MediaRow = Record<string, unknown> & { id: string };
const rows = new Map<string, MediaRow>();
const deleteCalls: Array<{ providerId: string; mediaType: string }> = [];
let createFailure: unknown = null;
let readFailure: unknown = null;
let chapterRelationship = true;
let journeyRecord: Record<string, unknown> | null = null;

const prisma = {
  media: {
    async create({ data }: { data: MediaRow }) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      if (createFailure) throw createFailure;
      if (rows.has(data.id)) {
        throw { code: "P2002", meta: { target: ["id"] } };
      }
      rows.set(data.id, { ...data });
      return data;
    },
    async findUnique({ where }: { where: { id: string } }) {
      if (readFailure) throw readFailure;
      return rows.get(where.id) ?? null;
    },
    async findFirst({ where }: { where: { id: string; chapterId?: string } }) {
      const row = rows.get(where.id);
      return row && (!where.chapterId || row.chapterId === where.chapterId) ? row : null;
    },
    async aggregate() {
      return { _max: { order: null } };
    },
    async delete({ where }: { where: { id: string } }) {
      rows.delete(where.id);
      return {};
    },
    async findMany({ where }: { where?: { chapterId?: string } } = {}) {
      return [...rows.values()].filter(
        (row) => !where?.chapterId || row.chapterId === where.chapterId,
      );
    },
  },
  chapter: {
    async findFirst() {
      return chapterRelationship ? { id: "chapter-1" } : null;
    },
    async deleteMany() {
      return { count: chapterRelationship ? 1 : 0 };
    },
  },
  journey: {
    async findUnique() {
      return journeyRecord;
    },
    async delete() {
      return {};
    },
  },
};

const cloudinaryProvider = {
  getImageDerivativeUrls(providerId: string) {
    return {
      thumbnailUrl: `https://res.cloudinary.com/test/image/upload/w_400/${providerId}`,
      blurDataUrl: `https://res.cloudinary.com/test/image/upload/e_blur/${providerId}`,
    };
  },
  async delete(providerId: string, mediaType: string) {
    deleteCalls.push({ providerId, mediaType });
    return true;
  },
};

type MockModule = (
  specifier: string,
  options: { exports: Record<string, unknown> },
) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);
mockModule("../lib/prisma", {
  exports: { prisma, default: prisma },
});
mockModule("../services/storage/cloudinary.provider", {
  exports: { cloudinaryProvider },
});
let mediaService!: typeof import("../services/media.service");
let chapterService!: typeof import("../services/chapter.service");
let journeyService!: typeof import("../services/journey.service");
before(async () => {
  mediaService = await import("../services/media.service");
  chapterService = await import("../services/chapter.service");
  journeyService = await import("../services/journey.service");
});

const uploadId = "123e4567-e89b-42d3-a456-426614174000";
const authorization: MediaUploadAuthorization = {
  version: 1,
  uploadId,
  actorId: "admin-1",
  purpose: "lib",
  resourceType: "image",
  expectedPublicId: uploadId,
  issuedAt: 2_000_000_000,
  expiresAt: 2_000_001_800,
};

function resource(
  overrides: Partial<AuthoritativeProviderResource> = {},
): AuthoritativeProviderResource {
  return {
    publicId: uploadId,
    resourceType: "image",
    deliveryType: "upload",
    format: "jpg",
    bytes: 1024,
    secureUrl: `https://res.cloudinary.com/test/image/upload/${uploadId}.jpg`,
    originalFilename: "photo",
    width: 1200,
    height: 800,
    duration: null,
    context: { wsid: uploadId, wsp: "lib" },
    ...overrides,
  };
}

function reset() {
  rows.clear();
  deleteCalls.length = 0;
  createFailure = null;
  readFailure = null;
  chapterRelationship = true;
  journeyRecord = null;
}

test("create-first finalization is idempotent and concurrent retries produce one row", async () => {
  reset();
  const first = await mediaService.finalizeVerifiedMediaUpload(
    authorization,
    resource(),
    "admin-1",
  );
  const retry = await mediaService.finalizeVerifiedMediaUpload(
    authorization,
    resource(),
    "admin-1",
  );
  assert.deepEqual(first, { success: true, data: { mediaId: uploadId, created: true } });
  assert.deepEqual(retry, { success: true, data: { mediaId: uploadId, created: false } });
  assert.equal(rows.size, 1);

  reset();
  const concurrent = await Promise.all([
    mediaService.finalizeVerifiedMediaUpload(authorization, resource(), "admin-1"),
    mediaService.finalizeVerifiedMediaUpload(authorization, resource(), "admin-1"),
  ]);
  assert.equal(rows.size, 1);
  assert.deepEqual(concurrent.map((result) => result.success && result.data.created).sort(), [false, true]);
});

test("mismatched existing Media identity fails closed without cleanup", async () => {
  reset();
  const expected = mediaService.buildVerifiedMediaData(authorization, resource(), "admin-1");
  rows.set(uploadId, { ...expected, providerId: "different-provider-id" });
  const result = await mediaService.finalizeVerifiedMediaUpload(
    authorization,
    resource(),
    "admin-1",
  );
  assert.equal(result.success, false);
  assert.equal(!result.success && result.error.code, "UPLOAD_CONFLICT");
  assert.equal(deleteCalls.length, 0);
});

test("identity and context tampering never triggers provider deletion", async () => {
  for (const candidate of [
    resource({ publicId: "223e4567-e89b-42d3-a456-426614174000" }),
    resource({ resourceType: "video" }),
    resource({ context: { wsid: "223e4567-e89b-42d3-a456-426614174000", wsp: "lib" } }),
    resource({ context: { wsid: uploadId, wsp: "ch" } }),
    resource({ deliveryType: "fetch" }),
  ]) {
    reset();
    const result = await mediaService.finalizeVerifiedMediaUpload(
      authorization,
      candidate,
      "admin-1",
    );
    assert.equal(result.success, false);
    assert.equal(deleteCalls.length, 0);
  }
});

test("verified policy rejection cleans only the proven resource with correct type", async () => {
  for (const candidate of [
    resource({ bytes: 20 * 1024 * 1024 + 1 }),
    resource({ format: "gif" }),
    resource({ width: null }),
  ]) {
    reset();
    const result = await mediaService.finalizeVerifiedMediaUpload(
      authorization,
      candidate,
      "admin-1",
    );
    assert.equal(result.success, false);
    assert.deepEqual(deleteCalls, [{ providerId: uploadId, mediaType: "IMAGE" }]);
  }
});

test("definitive DB failure cleans, ambiguous DB state does not", async () => {
  reset();
  createFailure = new Error("write failed");
  const definitive = await mediaService.finalizeVerifiedMediaUpload(
    authorization,
    resource(),
    "admin-1",
  );
  assert.equal(definitive.success, false);
  assert.deepEqual(deleteCalls, [{ providerId: uploadId, mediaType: "IMAGE" }]);

  reset();
  createFailure = new Error("write unavailable");
  readFailure = new Error("read unavailable");
  const ambiguous = await mediaService.finalizeVerifiedMediaUpload(
    authorization,
    resource(),
    "admin-1",
  );
  assert.equal(ambiguous.success, false);
  assert.equal(deleteCalls.length, 0);
});

test("an existing matching row prevents cleanup after an uncertain write error", async () => {
  reset();
  const expected = mediaService.buildVerifiedMediaData(authorization, resource(), "admin-1");
  rows.set(uploadId, { ...expected, order: 0 });
  createFailure = new Error("response lost");
  const result = await mediaService.finalizeVerifiedMediaUpload(
    authorization,
    resource(),
    "admin-1",
  );
  assert.deepEqual(result, { success: true, data: { mediaId: uploadId, created: false } });
  assert.equal(deleteCalls.length, 0);
});

test("individual and chapter permanent delete propagate IMAGE, VIDEO, and DOCUMENT types", async () => {
  for (const mediaType of ["IMAGE", "VIDEO", "DOCUMENT"] as const) {
    reset();
    rows.set(uploadId, {
      id: uploadId,
      providerId: `${mediaType.toLowerCase()}-asset`,
      type: mediaType,
      chapterId: "chapter-1",
    });
    const individual = await mediaService.deleteMedia(uploadId);
    assert.equal(individual.success, true);
    assert.deepEqual(deleteCalls[0], {
      providerId: `${mediaType.toLowerCase()}-asset`,
      mediaType,
    });

    reset();
    rows.set(uploadId, {
      id: uploadId,
      providerId: `${mediaType.toLowerCase()}-chapter-asset`,
      type: mediaType,
      chapterId: "chapter-1",
    });
    const chapter = await mediaService.deleteMediaPermanently(
      "journey-1",
      "chapter-1",
      uploadId,
    );
    assert.equal(chapter.success, true);
    assert.deepEqual(deleteCalls[0], {
      providerId: `${mediaType.toLowerCase()}-chapter-asset`,
      mediaType,
    });
  }
});

test("chapter and journey cascades retain media type for provider cleanup", async () => {
  reset();
  rows.set("chapter-image", {
    id: "chapter-image",
    providerId: "chapter-image-provider",
    type: "IMAGE",
    chapterId: "chapter-1",
  });
  rows.set("chapter-video", {
    id: "chapter-video",
    providerId: "chapter-video-provider",
    type: "VIDEO",
    chapterId: "chapter-1",
  });
  const chapterResult = await chapterService.deleteChapter("journey-1", "chapter-1");
  assert.equal(chapterResult.success, true);
  assert.deepEqual(deleteCalls, [
    { providerId: "chapter-image-provider", mediaType: "IMAGE" },
    { providerId: "chapter-video-provider", mediaType: "VIDEO" },
  ]);

  reset();
  journeyRecord = {
    id: "journey-1",
    slug: "journey",
    destination: { slug: "destination" },
    media: [{ providerId: "journey-pdf", type: "DOCUMENT" }],
    chapters: [{ media: [{ providerId: "journey-video", type: "VIDEO" }] }],
  };
  const journeyResult = await journeyService.deleteJourney("journey-1");
  assert.equal(journeyResult.success, true);
  assert.deepEqual(deleteCalls, [
    { providerId: "journey-pdf", mediaType: "DOCUMENT" },
    { providerId: "journey-video", mediaType: "VIDEO" },
  ]);
});

test("authoritative PDF/video mapping is preserved and chapter video is rejected", async () => {
  reset();
  const pdf = mediaService.buildVerifiedMediaData(
    authorization,
    resource({
      format: "pdf",
      secureUrl: `https://res.cloudinary.com/test/image/upload/${uploadId}.pdf`,
      width: null,
      height: null,
    }),
    "admin-1",
  );
  assert.equal(pdf.type, "DOCUMENT");
  assert.equal(pdf.mimeType, "application/pdf");

  const videoAuthorization: MediaUploadAuthorization = {
    ...authorization,
    resourceType: "video",
  };
  const videoResource = resource({
    resourceType: "video",
    format: "mp4",
    bytes: 100 * 1024 * 1024,
    secureUrl: `https://res.cloudinary.com/test/video/upload/${uploadId}.mp4`,
    width: 1920,
    height: 1080,
    duration: 12.4,
  });
  const video = mediaService.buildVerifiedMediaData(
    videoAuthorization,
    videoResource,
    "admin-1",
  );
  assert.equal(video.type, "VIDEO");
  assert.equal(video.mimeType, "video/mp4");
  assert.equal(video.duration, 12);

  reset();
  const chapterVideoAuthorization: MediaUploadAuthorization = {
    ...videoAuthorization,
    purpose: "ch",
    journeyId: "journey-1",
    chapterId: "chapter-1",
  };
  const rejected = await mediaService.finalizeVerifiedMediaUpload(
    chapterVideoAuthorization,
    { ...videoResource, context: { wsid: uploadId, wsp: "ch" } },
    "admin-1",
  );
  assert.equal(!rejected.success && rejected.error.code, "PROVIDER_REJECTED");
  assert.deepEqual(deleteCalls, [{ providerId: uploadId, mediaType: "VIDEO" }]);
});
