import assert from "node:assert/strict";
import test, { before, mock } from "node:test";
import { v2 as cloudinary } from "cloudinary";
import {
  MEDIA_UPLOAD_AUTHORIZATION_TTL_SECONDS,
  canonicalizeMediaUploadAuthorization,
  chapterMediaUploadDeclarationSchema,
  libraryMediaUploadDeclarationSchema,
  mediaUploadAuthorizationSchema,
  validateMediaUploadAuthorizationTime,
  type MediaUploadAuthorization,
} from "../lib/validation/media-upload.schema";
import { parseCloudinaryUploadProof } from "../lib/cloudinary-upload.client";

process.env.CLOUDINARY_CLOUD_NAME = "mf2-test";
process.env.CLOUDINARY_API_KEY = "mf2-test-key";
process.env.CLOUDINARY_API_SECRET = "mf2-test-secret";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  signature_version: 1,
});

let providerModule!: typeof import("../services/storage/cloudinary.provider");
before(async () => {
  providerModule = await import("../services/storage/cloudinary.provider");
});

const issuedAt = 2_000_000_000;
const chapterAuthorization: MediaUploadAuthorization = {
  version: 1,
  uploadId: "123e4567-e89b-42d3-a456-426614174000",
  actorId: "admin-1",
  purpose: "ch",
  resourceType: "image",
  expectedPublicId: "123e4567-e89b-42d3-a456-426614174000",
  issuedAt,
  expiresAt: issuedAt + MEDIA_UPLOAD_AUTHORIZATION_TTL_SECONDS,
  journeyId: "journey-1",
  chapterId: "chapter-1",
};

test("authorization schema is strict and enforces purpose-bound targets", () => {
  assert.equal(mediaUploadAuthorizationSchema.safeParse(chapterAuthorization).success, true);
  assert.equal(mediaUploadAuthorizationSchema.safeParse({
    ...chapterAuthorization,
    unexpected: true,
  }).success, false);
  assert.equal(mediaUploadAuthorizationSchema.safeParse({
    ...chapterAuthorization,
    purpose: "lib",
  }).success, false);
  assert.equal(mediaUploadAuthorizationSchema.safeParse({
    ...chapterAuthorization,
    expectedPublicId: "223e4567-e89b-42d3-a456-426614174000",
  }).success, false);
});

test("canonical authorization has one deterministic field order", () => {
  assert.equal(
    canonicalizeMediaUploadAuthorization(chapterAuthorization),
    '{"version":1,"uploadId":"123e4567-e89b-42d3-a456-426614174000","actorId":"admin-1","purpose":"ch","resourceType":"image","expectedPublicId":"123e4567-e89b-42d3-a456-426614174000","issuedAt":2000000000,"expiresAt":2000001800,"journeyId":"journey-1","chapterId":"chapter-1"}',
  );
});

test("application HMAC accepts valid proof and rejects every material mutation", () => {
  const proof = providerModule.createApplicationUploadProof(chapterAuthorization);
  assert.match(proof, /^[a-f0-9]{64}$/);
  assert.equal(providerModule.verifyApplicationUploadProof(chapterAuthorization, proof), true);
  assert.equal(providerModule.verifyApplicationUploadProof(chapterAuthorization, ""), false);

  const mutations: MediaUploadAuthorization[] = [
    { ...chapterAuthorization, actorId: "admin-2" },
    { ...chapterAuthorization, purpose: "lib" } as MediaUploadAuthorization,
    { ...chapterAuthorization, journeyId: "journey-2" },
    { ...chapterAuthorization, chapterId: "chapter-2" },
    {
      ...chapterAuthorization,
      expectedPublicId: "223e4567-e89b-42d3-a456-426614174000",
    },
    { ...chapterAuthorization, issuedAt: chapterAuthorization.issuedAt + 1 },
    { ...chapterAuthorization, expiresAt: chapterAuthorization.expiresAt + 1 },
  ];
  for (const mutation of mutations) {
    assert.equal(providerModule.verifyApplicationUploadProof(mutation, proof), false);
  }
});

test("authorization timing enforces fixed TTL, expiry, and future skew", () => {
  assert.equal(validateMediaUploadAuthorizationTime(chapterAuthorization, issuedAt), "valid");
  assert.equal(
    validateMediaUploadAuthorizationTime(chapterAuthorization, chapterAuthorization.expiresAt + 1),
    "expired",
  );
  assert.equal(
    validateMediaUploadAuthorizationTime(
      { ...chapterAuthorization, issuedAt: issuedAt + 31, expiresAt: issuedAt + 1831 },
      issuedAt,
    ),
    "invalid",
  );
  assert.equal(
    validateMediaUploadAuthorizationTime(
      { ...chapterAuthorization, expiresAt: chapterAuthorization.expiresAt + 1 },
      issuedAt,
    ),
    "invalid",
  );
});

test("provider response signature cannot substitute for application HMAC", () => {
  const version = 123;
  const signature = cloudinary.utils.api_sign_request(
    { public_id: chapterAuthorization.expectedPublicId, version },
    process.env.CLOUDINARY_API_SECRET!,
  );
  assert.equal(providerModule.cloudinaryProvider.verifyResponseSignature({
    public_id: chapterAuthorization.expectedPublicId,
    version,
    signature,
  }), true);
  assert.equal(
    providerModule.verifyApplicationUploadProof(chapterAuthorization, "0".repeat(64)),
    false,
  );
});

test("library and chapter declarations preserve their separate file policies", () => {
  assert.equal(libraryMediaUploadDeclarationSchema.safeParse({
    fileName: "clip.mp4",
    mimeType: "video/mp4",
    size: 100 * 1024 * 1024,
  }).success, true);
  assert.equal(libraryMediaUploadDeclarationSchema.safeParse({
    fileName: "guide.pdf",
    mimeType: "application/pdf",
    size: 20 * 1024 * 1024,
  }).success, true);
  assert.equal(chapterMediaUploadDeclarationSchema.safeParse({
    fileName: "clip.mp4",
    mimeType: "video/mp4",
    size: 1024,
  }).success, false);
  assert.equal(chapterMediaUploadDeclarationSchema.safeParse({
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 20 * 1024 * 1024 + 1,
  }).success, false);
});

test("Cloudinary destroy maps IMAGE/PDF to image and VIDEO to video", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const destroy = mock.method(
    cloudinary.uploader,
    "destroy",
    async (_providerId: string, options: Record<string, unknown>) => {
      calls.push(options);
      return { result: "ok" };
    },
  );
  try {
    await providerModule.cloudinaryProvider.delete("image-id", "IMAGE");
    await providerModule.cloudinaryProvider.delete("video-id", "VIDEO");
    await providerModule.cloudinaryProvider.delete("pdf-id", "DOCUMENT");
  } finally {
    destroy.mock.restore();
  }

  assert.deepEqual(calls.map((options) => options.resource_type), ["image", "video", "image"]);
  for (const options of calls) {
    assert.equal(options.type, "upload");
    assert.equal(options.invalidate, true);
  }
});

test("browser response parsing keeps only provider proof and ignores claimed metadata", () => {
  const parsed = parseCloudinaryUploadProof(JSON.stringify({
    public_id: chapterAuthorization.expectedPublicId,
    version: 1,
    signature: "b".repeat(40),
    secure_url: "https://attacker.invalid/not-authoritative",
    bytes: 1,
    format: "gif",
    asset_id: "untrusted",
  }));
  assert.deepEqual(parsed, {
    public_id: chapterAuthorization.expectedPublicId,
    version: 1,
    signature: "b".repeat(40),
  });
});

test("signed provider policy is exact for dynamic folders and minimal context", () => {
  const bundle = providerModule.cloudinaryProvider.authorizeUpload(
    chapterAuthorization,
    "jpg,jpeg",
  );
  assert.deepEqual(bundle.providerParams, {
    timestamp: chapterAuthorization.issuedAt,
    public_id: chapterAuthorization.uploadId,
    asset_folder: "wanderstory",
    use_asset_folder_as_public_id_prefix: false,
    overwrite: false,
    unique_filename: false,
    use_filename: false,
    allowed_formats: "jpg,jpeg",
    context: `wsid=${chapterAuthorization.uploadId}|wsp=ch`,
    type: "upload",
  });
  assert.equal(bundle.uploadUrl, "https://api.cloudinary.com/v1_1/mf2-test/image/upload");
  assert.equal(JSON.stringify(bundle).includes(process.env.CLOUDINARY_API_SECRET!), false);
  assert.equal("folder" in bundle.providerParams, false);
  assert.equal("public_id_prefix" in bundle.providerParams, false);
});
