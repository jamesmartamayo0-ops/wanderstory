import assert from "node:assert/strict";
import { mock } from "node:test";
import test, { before } from "node:test";
import type { MediaUploadAuthorization } from "../lib/validation/media-upload.schema";
import type {
  AuthoritativeProviderResource,
  MediaUploadAuthorizationBundle,
} from "../services/storage/storage.types";

type Actor = { id: string; email: string; name: null; role: "SUPER_ADMIN" | "EDITOR" };
let permissionResult:
  | { ok: true; actor: Actor }
  | { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" } = {
    ok: false,
    reason: "UNAUTHORIZED",
  };
let relationshipValid = true;
let rateAllowed = true;
let appHmacValid = true;
let providerSignatureValid = true;
let lookupCount = 0;
let auditCount = 0;
let finalizationCount = 0;
let created = true;

const now = Math.floor(Date.now() / 1000);
const uploadId = "123e4567-e89b-42d3-a456-426614174000";
const libraryAuthorization: MediaUploadAuthorization = {
  version: 1,
  uploadId,
  actorId: "admin-1",
  purpose: "lib",
  resourceType: "image",
  expectedPublicId: uploadId,
  issuedAt: now,
  expiresAt: now + 1800,
};
const chapterAuthorization: MediaUploadAuthorization = {
  ...libraryAuthorization,
  purpose: "ch",
  journeyId: "journey-1",
  chapterId: "chapter-1",
};

function bundle(authorization: MediaUploadAuthorization): MediaUploadAuthorizationBundle {
  return {
    cloudName: "test",
    apiKey: "test-key",
    uploadUrl: `https://api.cloudinary.com/v1_1/test/${authorization.resourceType}/upload`,
    resourceType: authorization.resourceType,
    providerParams: {
      timestamp: authorization.issuedAt,
      public_id: authorization.expectedPublicId,
      asset_folder: "wanderstory",
      use_asset_folder_as_public_id_prefix: false,
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      allowed_formats: "jpg,jpeg",
      context: `wsid=${authorization.uploadId}|wsp=${authorization.purpose}`,
      type: "upload",
    },
    providerSignature: "c".repeat(40),
    authorization,
    applicationProof: "a".repeat(64),
  };
}

const authoritativeResource: AuthoritativeProviderResource = {
  publicId: uploadId,
  resourceType: "image",
  deliveryType: "upload",
  format: "jpg",
  bytes: 1024,
  secureUrl: `https://res.cloudinary.com/test/image/upload/${uploadId}.jpg`,
  originalFilename: "photo",
  width: 100,
  height: 100,
  duration: null,
  context: { wsid: uploadId, wsp: "lib" },
};

const cloudinaryProvider = {
  authorizeUpload(authorization: MediaUploadAuthorization) {
    return bundle(authorization);
  },
  verifyResponseSignature(proof: { public_id: string; version: number; signature: string }) {
    return providerSignatureValid &&
      proof.public_id === uploadId &&
      proof.version === 1 &&
      proof.signature === "b".repeat(40);
  },
  async getAuthoritativeResource() {
    lookupCount += 1;
    return authoritativeResource;
  },
};

type MockModule = (
  specifier: string,
  options: { exports: Record<string, unknown> },
) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);
mockModule("../lib/authz", {
  exports: {
    requirePermission: async () => permissionResult,
  },
});
mockModule("../lib/audit", {
  exports: {
    auditFromRequest: async () => {
      auditCount += 1;
    },
  },
});
mockModule("next/cache", {
  exports: { revalidatePath: () => undefined },
});
mockModule("../lib/revalidate", {
  exports: { revalidateJourneyPaths: () => undefined },
});
mockModule("../lib/rate-limit", {
  exports: {
    checkRateLimit: async () => ({
      allowed: rateAllowed,
      count: rateAllowed ? 1 : 11,
      remaining: rateAllowed ? 9 : 0,
      retryAfterSeconds: rateAllowed ? 0 : 42,
    }),
  },
});
mockModule("../services/chapter.service", {
  exports: {
    verifyChapterOwnership: async () => relationshipValid,
  },
});
mockModule("../services/storage/cloudinary.provider", {
  exports: {
    cloudinaryProvider,
    verifyApplicationUploadProof: () => appHmacValid,
  },
});
mockModule("../services/media.service", {
  exports: {
    finalizeVerifiedMediaUpload: async () => {
      finalizationCount += 1;
      return { success: true, data: { mediaId: uploadId, created } };
    },
  },
});

let actions!: typeof import("../actions/media.actions");
before(async () => {
  actions = await import("../actions/media.actions");
});

function setActor(role: "SUPER_ADMIN" | "EDITOR" = "SUPER_ADMIN", id = "admin-1") {
  permissionResult = {
    ok: true,
    actor: { id, email: `${id}@example.com`, name: null, role },
  };
}

function finalizationInput(authorization = libraryAuthorization) {
  return {
    authorization,
    applicationProof: "a".repeat(64),
    providerProof: {
      public_id: uploadId,
      version: 1,
      signature: "b".repeat(40),
    },
  };
}

function reset() {
  setActor();
  relationshipValid = true;
  rateAllowed = true;
  appHmacValid = true;
  providerSignatureValid = true;
  lookupCount = 0;
  auditCount = 0;
  finalizationCount = 0;
  created = true;
}

test("anonymous and forced permission denial fail both sign and finalize", async () => {
  reset();
  permissionResult = { ok: false, reason: "UNAUTHORIZED" };
  const anonymousSign = await actions.signMediaUpload({
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 100,
  });
  const anonymousFinalize = await actions.finalizeMediaUpload(finalizationInput());
  assert.equal(anonymousSign.success, false);
  assert.equal(!anonymousSign.success && anonymousSign.error.code, "UNAUTHORIZED");
  assert.equal(anonymousFinalize.success, false);

  permissionResult = { ok: false, reason: "FORBIDDEN" };
  const forbidden = await actions.signMediaUpload({
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 100,
  });
  assert.equal(!forbidden.success && forbidden.error.code, "FORBIDDEN");
});

test("SUPER_ADMIN and EDITOR are allowed when media:upload permission succeeds", async () => {
  for (const role of ["SUPER_ADMIN", "EDITOR"] as const) {
    reset();
    setActor(role);
    const result = await actions.signMediaUpload({
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      size: 100,
    });
    assert.equal(result.success, true);
    assert.equal(result.success && result.data.authorization.actorId, "admin-1");
  }
});

test("chapter relationship is independently enforced for sign and finalize", async () => {
  reset();
  relationshipValid = false;
  const sign = await actions.uploadChapterMedia("journey-1", "wrong-chapter", {
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 100,
  });
  const finalize = await actions.finalizeChapterMediaUpload(
    finalizationInput(chapterAuthorization),
  );
  assert.equal(!sign.success && sign.error.code, "FORBIDDEN");
  assert.equal(!finalize.success && finalize.error.code, "FORBIDDEN");
  assert.equal(lookupCount, 0);
});

test("a different authenticated actor cannot finalize a signed upload", async () => {
  reset();
  setActor("EDITOR", "admin-2");
  const result = await actions.finalizeMediaUpload(finalizationInput());
  assert.equal(!result.success && result.error.code, "FORBIDDEN");
  assert.equal(lookupCount, 0);
});

test("invalid application HMAC rejects even when provider signature is valid", async () => {
  reset();
  appHmacValid = false;
  providerSignatureValid = true;
  const result = await actions.finalizeMediaUpload(finalizationInput());
  assert.equal(!result.success && result.error.code, "INVALID_PROVIDER_PROOF");
  assert.equal(lookupCount, 0);
  assert.equal(finalizationCount, 0);
});

test("provider public ID, version, signature, and missing fields fail before lookup", async () => {
  const candidates: unknown[] = [
    {
      ...finalizationInput(),
      providerProof: {
        ...finalizationInput().providerProof,
        public_id: "223e4567-e89b-42d3-a456-426614174000",
      },
    },
    {
      ...finalizationInput(),
      providerProof: { ...finalizationInput().providerProof, version: 2 },
    },
    {
      ...finalizationInput(),
      providerProof: { ...finalizationInput().providerProof, signature: "c".repeat(40) },
    },
    {
      ...finalizationInput(),
      providerProof: { public_id: uploadId, version: 1 },
    },
    {
      ...finalizationInput(),
      providerProof: { ...finalizationInput().providerProof, secure_url: "https://attacker.invalid/a" },
    },
  ];

  for (const candidate of candidates) {
    reset();
    const result = await actions.finalizeMediaUpload(candidate);
    assert.equal(result.success, false);
    assert.equal(lookupCount, 0);
    assert.equal(finalizationCount, 0);
  }
});

test("rate limiting is shared and returns a safe retry interval", async () => {
  reset();
  rateAllowed = false;
  const library = await actions.signMediaUpload({
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 100,
  });
  const chapter = await actions.uploadChapterMedia("journey-1", "chapter-1", {
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 100,
  });
  assert.equal(!library.success && library.error.code, "RATE_LIMITED");
  assert.equal(!library.success && library.error.retryAfterSeconds, 42);
  assert.equal(!chapter.success && chapter.error.code, "RATE_LIMITED");
});

test("new finalization audits once while idempotent retry does not duplicate audit", async () => {
  reset();
  const first = await actions.finalizeMediaUpload(finalizationInput());
  assert.equal(first.success, true);
  assert.equal(auditCount, 1);

  created = false;
  const retry = await actions.finalizeMediaUpload(finalizationInput());
  assert.equal(retry.success, true);
  assert.equal(auditCount, 1);
  assert.equal(finalizationCount, 2);
});
