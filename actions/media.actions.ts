"use server";

import { randomUUID } from "node:crypto";
import { requirePermission } from "@/lib/authz";
import { auditFromRequest } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { revalidateJourneyPaths } from "@/lib/revalidate";
import { checkRateLimit } from "@/lib/rate-limit";
import { updateMediaSchema } from "@/lib/validation/media.schema";
import {
  MEDIA_UPLOAD_AUTHORIZATION_TTL_SECONDS,
  chapterMediaUploadDeclarationSchema,
  getCloudinaryAllowedFormats,
  getCloudinaryResourceType,
  libraryMediaUploadDeclarationSchema,
  mediaUploadAuthorizationSchema,
  mediaUploadFinalizationSchema,
  validateMediaUploadAuthorizationTime,
  type MediaUploadAuthorization,
  type MediaUploadDeclaration,
  type MediaUploadPurpose,
} from "@/lib/validation/media-upload.schema";
import {
  attachChapterMediaSchema,
  removeChapterMediaSchema,
  deleteChapterMediaSchema,
  reorderChapterMediaSchema,
} from "@/lib/validation/chapter-media.schema";
import * as mediaService from "@/services/media.service";
import { verifyChapterOwnership } from "@/services/chapter.service";
import {
  cloudinaryProvider,
  verifyApplicationUploadProof,
} from "@/services/storage/cloudinary.provider";
import type {
  MediaUploadActionResult,
  MediaUploadAuthorizationBundle,
  MediaUploadFinalizationRequest,
} from "@/services/storage/storage.types";
import type { ActionResult } from "@/types";

function forbidden(authz: { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }): ActionResult {
  return {
    success: false,
    error: authz.reason === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
  };
}

function uploadError<T>(
  code: Parameters<typeof makeUploadError>[0],
  message: string,
  retryAfterSeconds?: number,
): MediaUploadActionResult<T> {
  return { success: false, error: makeUploadError(code, message, retryAfterSeconds) };
}

function makeUploadError(
  code:
    | "INVALID_TYPE"
    | "FILE_TOO_LARGE"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "RATE_LIMITED"
    | "AUTHORIZATION_EXPIRED"
    | "UPLOAD_AUTHORIZATION_FAILED"
    | "PROVIDER_REJECTED"
    | "NETWORK_ERROR"
    | "INVALID_PROVIDER_PROOF"
    | "FINALIZATION_FAILED"
    | "UPLOAD_CONFLICT"
    | "UNEXPECTED",
  message: string,
  retryAfterSeconds?: number,
) {
  return { code, message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) };
}

function forbiddenUpload<T>(
  authz: { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" },
): MediaUploadActionResult<T> {
  return authz.reason === "FORBIDDEN"
    ? uploadError("FORBIDDEN", "You do not have permission to upload media")
    : uploadError("UNAUTHORIZED", "Sign in to upload media");
}

async function authorizeMediaUpload(
  purpose: MediaUploadPurpose,
  declarationInput: unknown,
  target?: { journeyId: string; chapterId: string },
): Promise<MediaUploadActionResult<MediaUploadAuthorizationBundle>> {
  const authz = await requirePermission("media:upload");
  if (!authz.ok) {
    return forbiddenUpload(authz);
  }

  if (purpose === "ch") {
    let targetIsValid = false;
    try {
      targetIsValid = Boolean(
        target && await verifyChapterOwnership(target.journeyId, target.chapterId),
      );
    } catch (error) {
      console.error("Chapter upload authorization target check failed:", error);
      return uploadError("UPLOAD_AUTHORIZATION_FAILED", "Upload authorization is temporarily unavailable");
    }
    if (!targetIsValid) {
      return uploadError("FORBIDDEN", "The chapter upload target is not available");
    }
  }

  let rateLimit;
  try {
    rateLimit = await checkRateLimit(`media-upload-sign:${authz.actor.id}`, {
      limit: 10,
      windowSeconds: 60,
    });
  } catch (error) {
    console.error("Media upload signing rate limit failed closed:", error);
    return uploadError("UPLOAD_AUTHORIZATION_FAILED", "Upload authorization is temporarily unavailable");
  }

  if (!rateLimit.allowed) {
    return uploadError(
      "RATE_LIMITED",
      "Too many upload attempts. Please wait before trying again",
      rateLimit.retryAfterSeconds,
    );
  }

  const declarationSchema = purpose === "ch"
    ? chapterMediaUploadDeclarationSchema
    : libraryMediaUploadDeclarationSchema;
  const parsedDeclaration = declarationSchema.safeParse(declarationInput);
  if (!parsedDeclaration.success) {
    const sizeError = parsedDeclaration.error.issues.some((issue) => issue.path[0] === "size");
    return sizeError
      ? uploadError("FILE_TOO_LARGE", "The selected file exceeds the upload limit")
      : uploadError("INVALID_TYPE", "The selected file type is not supported");
  }

  const declaration: MediaUploadDeclaration = parsedDeclaration.data;
  const issuedAt = Math.floor(Date.now() / 1000);
  const uploadId = randomUUID();
  const authorizationCandidate = purpose === "ch"
    ? {
        version: 1 as const,
        uploadId,
        actorId: authz.actor.id,
        purpose,
        resourceType: getCloudinaryResourceType(declaration.mimeType),
        expectedPublicId: uploadId,
        issuedAt,
        expiresAt: issuedAt + MEDIA_UPLOAD_AUTHORIZATION_TTL_SECONDS,
        journeyId: target?.journeyId,
        chapterId: target?.chapterId,
      }
    : {
        version: 1 as const,
        uploadId,
        actorId: authz.actor.id,
        purpose,
        resourceType: getCloudinaryResourceType(declaration.mimeType),
        expectedPublicId: uploadId,
        issuedAt,
        expiresAt: issuedAt + MEDIA_UPLOAD_AUTHORIZATION_TTL_SECONDS,
      };
  const parsedAuthorization = mediaUploadAuthorizationSchema.safeParse(authorizationCandidate);
  if (!parsedAuthorization.success) {
    return uploadError("UPLOAD_AUTHORIZATION_FAILED", "Upload authorization could not be created");
  }

  try {
    return {
      success: true,
      data: cloudinaryProvider.authorizeUpload(
        parsedAuthorization.data,
        getCloudinaryAllowedFormats(declaration.mimeType),
      ),
    };
  } catch (error) {
    console.error("Media upload authorization failed:", error);
    return uploadError("UPLOAD_AUTHORIZATION_FAILED", "Upload authorization is temporarily unavailable");
  }
}

export async function signMediaUpload(
  declaration: unknown,
): Promise<MediaUploadActionResult<MediaUploadAuthorizationBundle>> {
  return authorizeMediaUpload("lib", declaration);
}

export async function uploadChapterMedia(
  journeyId: string,
  chapterId: string,
  declaration: unknown,
): Promise<MediaUploadActionResult<MediaUploadAuthorizationBundle>> {
  return authorizeMediaUpload("ch", declaration, { journeyId, chapterId });
}

async function finalizeUpload(
  expectedPurpose: MediaUploadPurpose,
  input: unknown,
): Promise<MediaUploadActionResult<{ mediaId: string; created: boolean }>> {
  const authz = await requirePermission("media:upload");
  if (!authz.ok) return forbiddenUpload(authz);

  const parsed = mediaUploadFinalizationSchema.safeParse(input);
  if (!parsed.success) {
    return uploadError("INVALID_PROVIDER_PROOF", "The upload proof is invalid");
  }
  const request: MediaUploadFinalizationRequest = parsed.data;
  const authorization: MediaUploadAuthorization = request.authorization;

  if (!verifyApplicationUploadProof(authorization, request.applicationProof)) {
    return uploadError("INVALID_PROVIDER_PROOF", "The upload authorization proof is invalid");
  }
  if (authorization.purpose !== expectedPurpose) {
    return uploadError("INVALID_PROVIDER_PROOF", "The upload purpose does not match");
  }
  if (authorization.actorId !== authz.actor.id) {
    return uploadError("FORBIDDEN", "This upload was authorized for a different account");
  }

  const now = Math.floor(Date.now() / 1000);
  const timing = validateMediaUploadAuthorizationTime(authorization, now);
  if (timing === "invalid") {
    return uploadError("INVALID_PROVIDER_PROOF", "The upload authorization timing is invalid");
  }
  if (timing === "expired") {
    return uploadError("AUTHORIZATION_EXPIRED", "The upload authorization has expired");
  }

  if (authorization.purpose === "ch") {
    let targetIsValid = false;
    try {
      targetIsValid = await verifyChapterOwnership(
        authorization.journeyId,
        authorization.chapterId,
      );
    } catch (error) {
      console.error("Chapter finalization target check failed:", error);
      return uploadError("FINALIZATION_FAILED", "The chapter upload target could not be confirmed");
    }
    if (!targetIsValid) {
      return uploadError("FORBIDDEN", "The chapter upload target is not available");
    }
  }
  if (request.providerProof.public_id !== authorization.expectedPublicId) {
    return uploadError("INVALID_PROVIDER_PROOF", "The provider public ID does not match");
  }
  if (!cloudinaryProvider.verifyResponseSignature(request.providerProof)) {
    return uploadError("INVALID_PROVIDER_PROOF", "The provider response signature is invalid");
  }

  let resource;
  try {
    resource = await cloudinaryProvider.getAuthoritativeResource(
      authorization.expectedPublicId,
      authorization.resourceType,
    );
  } catch (error) {
    console.error("Cloudinary authoritative lookup failed:", error);
    return uploadError("FINALIZATION_FAILED", "The uploaded asset could not be confirmed");
  }

  const result = await mediaService.finalizeVerifiedMediaUpload(
    authorization,
    resource,
    authz.actor.id,
  );
  if (!result.success) return result;

  if (result.data.created) {
    await auditFromRequest({
      eventType: "MEDIA_UPLOADED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "MEDIA",
      targetId: result.data.mediaId,
      ...(authorization.purpose === "ch"
        ? { metadata: { journeyId: authorization.journeyId, chapterId: authorization.chapterId } }
        : {}),
    });
  }

  if (authorization.purpose === "ch") {
    revalidateJourneyPaths(authorization.journeyId);
  } else {
    revalidatePath("/admin/media");
  }

  return result;
}

export async function finalizeMediaUpload(
  input: unknown,
): Promise<MediaUploadActionResult<{ mediaId: string; created: boolean }>> {
  return finalizeUpload("lib", input);
}

export async function finalizeChapterMediaUpload(
  input: unknown,
): Promise<MediaUploadActionResult<{ mediaId: string; created: boolean }>> {
  return finalizeUpload("ch", input);
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const authz = await requirePermission("media:delete", {
    targetType: "MEDIA",
    targetId: id,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await mediaService.deleteMedia(id);
  if (result.success) {
    await auditFromRequest({
      eventType: "MEDIA_DELETED_PERMANENT",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "MEDIA",
      targetId: id,
    });
    revalidatePath("/admin/media");
  }
  return result;
}

export async function updateMedia(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("media:update", {
    targetType: "MEDIA",
    targetId: id,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const parsed = updateMediaSchema.safeParse({
    altText: formData.get("altText"),
    role: formData.get("role"),
    order: formData.get("order"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await mediaService.updateMedia(id, parsed.data);
  if (result.success) {
    revalidatePath("/admin/media");
  }
  return result;
}

export async function attachMediaToChapter(
  journeyId: string,
  chapterId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("media:update");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const mediaIds = formData.getAll("mediaIds").map(String);

  const parsed = attachChapterMediaSchema.safeParse({
    chapterId,
    mediaIds,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await mediaService.attachMediaToChapter(
    journeyId,
    parsed.data.chapterId,
    parsed.data.mediaIds
  );

  if (result.success) {
    revalidateJourneyPaths(journeyId);
  }

  return result;
}

export async function removeChapterMedia(
  journeyId: string,
  chapterId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("media:detach");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const parsed = removeChapterMediaSchema.safeParse({
    chapterId,
    mediaId: formData.get("mediaId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await mediaService.removeMediaFromChapter(
    journeyId,
    parsed.data.chapterId,
    parsed.data.mediaId
  );

  if (result.success) {
    revalidateJourneyPaths(journeyId);
  }

  return result;
}

export async function deleteChapterMedia(
  journeyId: string,
  chapterId: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = deleteChapterMediaSchema.safeParse({
    chapterId,
    mediaId: formData.get("mediaId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const authz = await requirePermission("media:delete", {
    targetType: "MEDIA",
    targetId: parsed.data.mediaId,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await mediaService.deleteMediaPermanently(
    journeyId,
    parsed.data.chapterId,
    parsed.data.mediaId
  );

  if (result.success) {
    await auditFromRequest({
      eventType: "MEDIA_DELETED_PERMANENT",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "MEDIA",
      targetId: parsed.data.mediaId,
      metadata: { journeyId, chapterId },
    });
    revalidateJourneyPaths(journeyId);
  }

  return result;
}

export async function reorderChapterMedia(
  journeyId: string,
  chapterId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("media:reorder");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const mediaIds = formData.getAll("mediaIds").map(String);

  const parsed = reorderChapterMediaSchema.safeParse({
    chapterId,
    mediaIds,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await mediaService.reorderChapterMedia(
    journeyId,
    parsed.data.chapterId,
    parsed.data.mediaIds
  );

  if (result.success) {
    revalidateJourneyPaths(journeyId);
  }

  return result;
}

export async function updateChapterMediaAltText(
  journeyId: string,
  chapterId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("media:alt-text");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const mediaId = formData.get("mediaId");
  if (typeof mediaId !== "string" || mediaId.length === 0) {
    return { success: false, error: "Validation failed" };
  }

  const parsed = updateMediaSchema.safeParse({
    altText: formData.get("altText"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await mediaService.updateChapterMediaAltText(
    journeyId,
    chapterId,
    mediaId,
    parsed.data.altText ?? ""
  );

  if (result.success) {
    revalidateJourneyPaths(journeyId);
  }

  return result;
}
