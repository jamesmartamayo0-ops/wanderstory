import { z } from "zod";

export const MEDIA_UPLOAD_AUTHORIZATION_TTL_SECONDS = 30 * 60;
export const MEDIA_UPLOAD_FUTURE_SKEW_SECONDS = 30;
export const MEDIA_UPLOAD_ASSET_FOLDER = "wanderstory" as const;

export const MEDIA_UPLOAD_LIMITS = {
  image: 20 * 1024 * 1024,
  document: 20 * 1024 * 1024,
  video: 100 * 1024 * 1024,
} as const;

export const MEDIA_UPLOAD_ERROR_CODES = [
  "INVALID_TYPE",
  "FILE_TOO_LARGE",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "RATE_LIMITED",
  "AUTHORIZATION_EXPIRED",
  "UPLOAD_AUTHORIZATION_FAILED",
  "PROVIDER_REJECTED",
  "NETWORK_ERROR",
  "INVALID_PROVIDER_PROOF",
  "FINALIZATION_FAILED",
  "UPLOAD_CONFLICT",
  "UNEXPECTED",
] as const;

export type MediaUploadErrorCode = (typeof MEDIA_UPLOAD_ERROR_CODES)[number];
export type MediaUploadPurpose = "lib" | "ch";
export type CloudinaryResourceType = "image" | "video";

const safePositiveInteger = z
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger, "Must be a safe integer");

const boundedId = z.string().min(1).max(128);

export const mediaUploadDeclarationSchema = z.strictObject({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "video/mp4",
  ]),
  size: safePositiveInteger.max(MEDIA_UPLOAD_LIMITS.video),
});

export const libraryMediaUploadDeclarationSchema = mediaUploadDeclarationSchema.superRefine(
  (declaration, context) => {
    const maximum = getMaximumUploadBytes(declaration.mimeType);
    if (declaration.size > maximum) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: `File exceeds the ${Math.round(maximum / 1024 / 1024)}MB limit`,
      });
    }
  },
);

export const chapterMediaUploadDeclarationSchema = mediaUploadDeclarationSchema.superRefine(
  (declaration, context) => {
    if (!declaration.mimeType.startsWith("image/")) {
      context.addIssue({
        code: "custom",
        path: ["mimeType"],
        message: "Chapter uploads must be JPEG, PNG, or WebP images",
      });
    }
    if (declaration.size > MEDIA_UPLOAD_LIMITS.image) {
      context.addIssue({
        code: "custom",
        path: ["size"],
        message: "File exceeds the 20MB limit",
      });
    }
  },
);

const authorizationBase = {
  version: z.literal(1),
  uploadId: z.string().uuid(),
  actorId: boundedId,
  resourceType: z.enum(["image", "video"]),
  expectedPublicId: z.string().uuid(),
  issuedAt: safePositiveInteger,
  expiresAt: safePositiveInteger,
};

const libraryAuthorizationSchema = z
  .strictObject({
    ...authorizationBase,
    purpose: z.literal("lib"),
  })
  .refine((value) => value.expectedPublicId === value.uploadId, {
    path: ["expectedPublicId"],
    message: "Expected public ID must match upload ID",
  });

const chapterAuthorizationSchema = z
  .strictObject({
    ...authorizationBase,
    purpose: z.literal("ch"),
    journeyId: boundedId,
    chapterId: boundedId,
  })
  .refine((value) => value.expectedPublicId === value.uploadId, {
    path: ["expectedPublicId"],
    message: "Expected public ID must match upload ID",
  });

export const mediaUploadAuthorizationSchema = z.discriminatedUnion("purpose", [
  libraryAuthorizationSchema,
  chapterAuthorizationSchema,
]);

export const cloudinaryProviderProofSchema = z.strictObject({
  public_id: z.string().uuid(),
  version: safePositiveInteger,
  signature: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
});

export const mediaUploadFinalizationSchema = z.strictObject({
  authorization: mediaUploadAuthorizationSchema,
  applicationProof: z.string().regex(/^[a-f0-9]{64}$/),
  providerProof: cloudinaryProviderProofSchema,
});

const providerContextSchema = z
  .object({
    custom: z.record(z.string(), z.string()).optional(),
  })
  .catchall(z.unknown());

export const cloudinaryAuthoritativeResourceSchema = z
  .object({
    public_id: z.string().min(1).max(255),
    resource_type: z.enum(["image", "video"]),
    type: z.string().min(1).max(32).optional(),
    format: z.string().min(1).max(32),
    bytes: safePositiveInteger,
    secure_url: z.string().url().max(2048),
    original_filename: z.string().min(1).max(255).optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().positive().finite().optional(),
    context: providerContextSchema,
  })
  .passthrough();

export type MediaUploadDeclaration = z.infer<typeof mediaUploadDeclarationSchema>;
export type MediaUploadAuthorization = z.infer<typeof mediaUploadAuthorizationSchema>;
export type CloudinaryProviderProof = z.infer<typeof cloudinaryProviderProofSchema>;
export type CloudinaryAuthoritativeResourceInput = z.infer<
  typeof cloudinaryAuthoritativeResourceSchema
>;

export function canonicalizeMediaUploadAuthorization(
  authorization: MediaUploadAuthorization,
): string {
  const canonical = authorization.purpose === "ch"
    ? {
        version: authorization.version,
        uploadId: authorization.uploadId,
        actorId: authorization.actorId,
        purpose: authorization.purpose,
        resourceType: authorization.resourceType,
        expectedPublicId: authorization.expectedPublicId,
        issuedAt: authorization.issuedAt,
        expiresAt: authorization.expiresAt,
        journeyId: authorization.journeyId,
        chapterId: authorization.chapterId,
      }
    : {
        version: authorization.version,
        uploadId: authorization.uploadId,
        actorId: authorization.actorId,
        purpose: authorization.purpose,
        resourceType: authorization.resourceType,
        expectedPublicId: authorization.expectedPublicId,
        issuedAt: authorization.issuedAt,
        expiresAt: authorization.expiresAt,
      };

  return JSON.stringify(canonical);
}

export function validateMediaUploadAuthorizationTime(
  authorization: MediaUploadAuthorization,
  now: number,
): "valid" | "expired" | "invalid" {
  if (
    authorization.expiresAt !==
      authorization.issuedAt + MEDIA_UPLOAD_AUTHORIZATION_TTL_SECONDS ||
    authorization.issuedAt > now + MEDIA_UPLOAD_FUTURE_SKEW_SECONDS
  ) {
    return "invalid";
  }
  return now > authorization.expiresAt ? "expired" : "valid";
}

export function getMaximumUploadBytes(mimeType: string): number {
  if (mimeType === "video/mp4") return MEDIA_UPLOAD_LIMITS.video;
  if (mimeType === "application/pdf") return MEDIA_UPLOAD_LIMITS.document;
  return MEDIA_UPLOAD_LIMITS.image;
}

export function getCloudinaryResourceType(mimeType: string): CloudinaryResourceType {
  return mimeType === "video/mp4" ? "video" : "image";
}

export function getCloudinaryAllowedFormats(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg,jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    case "video/mp4":
      return "mp4";
    default:
      return "";
  }
}

export function getClientFileValidationError(
  file: Pick<File, "name" | "size" | "type">,
  purpose: MediaUploadPurpose,
): { code: MediaUploadErrorCode; message: string } | null {
  const schema = purpose === "ch"
    ? chapterMediaUploadDeclarationSchema
    : libraryMediaUploadDeclarationSchema;
  const parsed = schema.safeParse({
    fileName: file.name,
    mimeType: file.type,
    size: file.size,
  });

  if (!parsed.success) {
    const sizeIssue = parsed.error.issues.some((issue) => issue.path[0] === "size");
    return sizeIssue
      ? { code: "FILE_TOO_LARGE", message: parsed.error.issues[0]?.message ?? "File is too large" }
      : { code: "INVALID_TYPE", message: "Select a supported file type" };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowedExtensions: Record<string, readonly string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "application/pdf": ["pdf"],
    "video/mp4": ["mp4"],
  };
  if (!extension || !allowedExtensions[file.type]?.includes(extension)) {
    return { code: "INVALID_TYPE", message: "The file extension does not match its selected type" };
  }

  return null;
}
