import prisma from "../lib/prisma";
import { cloudinaryProvider } from "./storage/cloudinary.provider";
import { verifyChapterOwnership } from "./chapter.service";
import type {
  AuthoritativeProviderResource,
  MediaUploadActionResult,
} from "./storage/storage.types";
import {
  MEDIA_UPLOAD_LIMITS,
  type MediaUploadAuthorization,
  type MediaUploadPurpose,
} from "../lib/validation/media-upload.schema";
import type { MediaType } from "../app/generated/prisma/enums";
import type { UpdateMediaInput, MediaFilterInput } from "../lib/validation/media.schema";
import type { ActionResult } from "../types";

class MediaOperationError extends Error {}

export async function getAllMedia(filters?: MediaFilterInput) {
  const where: Record<string, unknown> = {};

  if (filters?.search) {
    where.fileName = { contains: filters.search, mode: "insensitive" };
  }
  if (filters?.type) {
    where.type = filters.type;
  }

  return prisma.media.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      uploader: { select: { id: true, name: true } },
    },
  });
}

export async function getMediaById(id: string) {
  return prisma.media.findUnique({
    where: { id },
    include: {
      uploader: { select: { id: true, name: true } },
    },
  });
}

type VerifiedMediaData = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: MediaType;
  format: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  provider: "CLOUDINARY";
  providerId: string;
  url: string;
  thumbnailUrl: string | null;
  blurDataUrl: string | null;
  role: "GALLERY" | "CHAPTER";
  uploaderId: string;
  chapterId: string | null;
};

class MediaPolicyError extends Error {}

function authoritativeFormatPolicy(
  resource: AuthoritativeProviderResource,
  purpose: MediaUploadPurpose,
): { mimeType: string; mediaType: MediaType; maximumBytes: number } {
  const mapping: Record<
    string,
    { mimeType: string; mediaType: MediaType; resourceType: "image" | "video"; maximumBytes: number }
  > = {
    jpg: {
      mimeType: "image/jpeg",
      mediaType: "IMAGE",
      resourceType: "image",
      maximumBytes: MEDIA_UPLOAD_LIMITS.image,
    },
    jpeg: {
      mimeType: "image/jpeg",
      mediaType: "IMAGE",
      resourceType: "image",
      maximumBytes: MEDIA_UPLOAD_LIMITS.image,
    },
    png: {
      mimeType: "image/png",
      mediaType: "IMAGE",
      resourceType: "image",
      maximumBytes: MEDIA_UPLOAD_LIMITS.image,
    },
    webp: {
      mimeType: "image/webp",
      mediaType: "IMAGE",
      resourceType: "image",
      maximumBytes: MEDIA_UPLOAD_LIMITS.image,
    },
    pdf: {
      mimeType: "application/pdf",
      mediaType: "DOCUMENT",
      resourceType: "image",
      maximumBytes: MEDIA_UPLOAD_LIMITS.document,
    },
    mp4: {
      mimeType: "video/mp4",
      mediaType: "VIDEO",
      resourceType: "video",
      maximumBytes: MEDIA_UPLOAD_LIMITS.video,
    },
  };
  const policy = mapping[resource.format];

  if (!policy || policy.resourceType !== resource.resourceType) {
    throw new MediaPolicyError("Unexpected provider format");
  }
  if (purpose === "ch" && policy.mediaType !== "IMAGE") {
    throw new MediaPolicyError("Chapter uploads must be images");
  }
  if (resource.bytes > policy.maximumBytes) {
    throw new MediaPolicyError("Provider resource exceeds the upload limit");
  }
  if (
    policy.mediaType === "IMAGE" &&
    (!resource.width || resource.width <= 0 || !resource.height || resource.height <= 0)
  ) {
    throw new MediaPolicyError("Provider image dimensions are invalid");
  }
  if (policy.mediaType === "VIDEO" && (!resource.duration || resource.duration <= 0)) {
    throw new MediaPolicyError("Provider video duration is invalid");
  }

  return policy;
}

export function buildVerifiedMediaData(
  authorization: MediaUploadAuthorization,
  resource: AuthoritativeProviderResource,
  uploaderId: string,
): VerifiedMediaData {
  const policy = authoritativeFormatPolicy(resource, authorization.purpose);
  const originalFilename = resource.originalFilename ?? authorization.uploadId;
  const extension = resource.format === "jpeg" ? "jpg" : resource.format;
  const fileName = originalFilename.toLowerCase().endsWith(`.${extension}`)
    ? originalFilename
    : `${originalFilename}.${extension}`;
  const derivatives = policy.mediaType === "IMAGE"
    ? cloudinaryProvider.getImageDerivativeUrls(resource.publicId)
    : null;

  return {
    id: authorization.uploadId,
    fileName,
    mimeType: policy.mimeType,
    size: resource.bytes,
    type: policy.mediaType,
    format: resource.format,
    width: resource.width,
    height: resource.height,
    duration: resource.duration === null ? null : Math.round(resource.duration),
    provider: "CLOUDINARY",
    providerId: resource.publicId,
    url: resource.secureUrl,
    thumbnailUrl: derivatives?.thumbnailUrl ?? null,
    blurDataUrl: derivatives?.blurDataUrl ?? null,
    role: authorization.purpose === "ch" ? "CHAPTER" : "GALLERY",
    uploaderId,
    chapterId: authorization.purpose === "ch" ? authorization.chapterId : null,
  };
}

function isPrimaryKeyConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
    return false;
  }
  const meta = "meta" in error && error.meta && typeof error.meta === "object"
    ? error.meta as Record<string, unknown>
    : null;
  const target = meta?.target;
  if (Array.isArray(target)) return target.length === 1 && target[0] === "id";
  return target === "id" || target === "Media_pkey";
}

function nullableEqual(left: unknown, right: unknown): boolean {
  return (left ?? null) === (right ?? null);
}

function existingMediaMatches(
  existing: Record<string, unknown>,
  expected: VerifiedMediaData,
): boolean {
  return (
    existing.id === expected.id &&
    existing.fileName === expected.fileName &&
    existing.mimeType === expected.mimeType &&
    existing.size === expected.size &&
    existing.type === expected.type &&
    existing.format === expected.format &&
    nullableEqual(existing.width, expected.width) &&
    nullableEqual(existing.height, expected.height) &&
    nullableEqual(existing.duration, expected.duration) &&
    existing.provider === expected.provider &&
    existing.providerId === expected.providerId &&
    existing.url === expected.url &&
    nullableEqual(existing.thumbnailUrl, expected.thumbnailUrl) &&
    nullableEqual(existing.blurDataUrl, expected.blurDataUrl) &&
    existing.uploaderId === expected.uploaderId &&
    existing.role === expected.role &&
    nullableEqual(existing.chapterId, expected.chapterId)
  );
}

async function cleanupOnlyWhenNoMediaRow(
  uploadId: string,
  resource: AuthoritativeProviderResource,
  mediaType: MediaType,
): Promise<void> {
  try {
    const existing = await prisma.media.findUnique({ where: { id: uploadId } });
    if (existing) return;
  } catch (error) {
    console.error("Media cleanup skipped because database state is ambiguous:", error);
    return;
  }

  const deleted = await cloudinaryProvider.delete(resource.publicId, mediaType);
  if (!deleted) {
    console.error("Verified Cloudinary cleanup failed for:", resource.publicId);
  }
}

export async function finalizeVerifiedMediaUpload(
  authorization: MediaUploadAuthorization,
  resource: AuthoritativeProviderResource,
  uploaderId: string,
): Promise<MediaUploadActionResult<{ mediaId: string; created: boolean }>> {
  if (
    resource.publicId !== authorization.expectedPublicId ||
    resource.resourceType !== authorization.resourceType ||
    resource.deliveryType !== "upload" ||
    resource.context.wsid !== authorization.uploadId ||
    resource.context.wsp !== authorization.purpose
  ) {
    return {
      success: false,
      error: { code: "INVALID_PROVIDER_PROOF", message: "The uploaded asset could not be verified" },
    };
  }

  let data: VerifiedMediaData;
  try {
    data = buildVerifiedMediaData(authorization, resource, uploaderId);
  } catch (error) {
    if (error instanceof MediaPolicyError) {
      const cleanupType: MediaType = resource.resourceType === "video" ? "VIDEO" : "IMAGE";
      await cleanupOnlyWhenNoMediaRow(authorization.uploadId, resource, cleanupType);
      return {
        success: false,
        error: { code: "PROVIDER_REJECTED", message: "The uploaded file does not meet the media policy" },
      };
    }
    return {
      success: false,
      error: { code: "FINALIZATION_FAILED", message: "Media finalization failed" },
    };
  }

  if (authorization.purpose === "ch") {
    try {
      if (!(await verifyChapterOwnership(authorization.journeyId, authorization.chapterId))) {
        return {
          success: false,
          error: { code: "FORBIDDEN", message: "The chapter upload target is no longer available" },
        };
      }
    } catch (error) {
      console.error("Chapter finalization relationship check failed:", error);
      return {
        success: false,
        error: { code: "FINALIZATION_FAILED", message: "The chapter upload target could not be confirmed" },
      };
    }
  }

  let order = 0;
  try {
    if (authorization.purpose === "ch") {
      const maxOrder = await prisma.media.aggregate({
        where: { chapterId: authorization.chapterId },
        _max: { order: true },
      });
      order = (maxOrder._max.order ?? -1) + 1;
    }

    await prisma.media.create({
      data: {
        ...data,
        order,
      },
    });
    return { success: true, data: { mediaId: data.id, created: true } };
  } catch (error) {
    if (isPrimaryKeyConflict(error)) {
      try {
        const existing = await prisma.media.findUnique({ where: { id: data.id } });
        if (existing && existingMediaMatches(existing, data)) {
          return { success: true, data: { mediaId: data.id, created: false } };
        }
        return {
          success: false,
          error: { code: "UPLOAD_CONFLICT", message: "This upload conflicts with an existing media record" },
        };
      } catch (readError) {
        console.error("Media idempotency check failed:", readError);
        return {
          success: false,
          error: { code: "FINALIZATION_FAILED", message: "Media finalization could not be confirmed" },
        };
      }
    }

    try {
      const existing = await prisma.media.findUnique({ where: { id: data.id } });
      if (existing) {
        if (existingMediaMatches(existing, data)) {
          return { success: true, data: { mediaId: data.id, created: false } };
        }
        return {
          success: false,
          error: { code: "UPLOAD_CONFLICT", message: "This upload conflicts with an existing media record" },
        };
      }
    } catch (readError) {
      console.error("Media persistence outcome is ambiguous; cleanup skipped:", readError);
      return {
        success: false,
        error: { code: "FINALIZATION_FAILED", message: "Media finalization could not be confirmed" },
      };
    }

    console.error("Media persistence failed:", error);
    await cleanupOnlyWhenNoMediaRow(data.id, resource, data.type);
    return {
      success: false,
      error: { code: "FINALIZATION_FAILED", message: "Media finalization failed" },
    };
  }
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  try {
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) {
      return { success: false, error: "Media not found" };
    }

    if (media.providerId) {
      const deleted = await cloudinaryProvider.delete(media.providerId, media.type);
      if (!deleted) {
        console.warn("Storage cleanup returned false for:", media.providerId);
      }
    }

    await prisma.media.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete media" };
  }
}

export async function updateMedia(
  id: string,
  data: UpdateMediaInput
): Promise<ActionResult> {
  try {
    const media = await prisma.media.update({
      where: { id },
      data,
    });
    return { success: true, data: media };
  } catch {
    return { success: false, error: "Failed to update media" };
  }
}

export async function purgeMediaAssets(
  providerAssets: Array<{ providerId: string | null; type: MediaType }>
): Promise<void> {
  for (const asset of providerAssets) {
    if (!asset.providerId) continue;
    try {
      await cloudinaryProvider.delete(asset.providerId, asset.type);
    } catch {
      // best-effort storage cleanup; failures are non-fatal
    }
  }
}

export async function attachMediaToChapter(
  journeyId: string,
  chapterId: string,
  mediaIds: string[]
): Promise<ActionResult> {
  try {
    if (!(await verifyChapterOwnership(journeyId, chapterId))) {
      return { success: false, error: "Chapter not found" };
    }

    await prisma.$transaction(async (tx) => {
      const maxOrder = await tx.media.aggregate({
        where: { chapterId },
        _max: { order: true },
      });
      let order = (maxOrder._max.order ?? -1) + 1;

      for (const mediaId of mediaIds) {
        const result = await tx.media.updateMany({
          where: { id: mediaId, chapterId: null },
          data: { chapterId, role: "CHAPTER", order },
        });
        if (result.count === 0) {
          throw new Error("Media unavailable");
        }
        order += 1;
      }
    });

    return { success: true };
  } catch {
    return { success: false, error: "Failed to attach media to chapter" };
  }
}

export async function removeMediaFromChapter(
  journeyId: string,
  chapterId: string,
  mediaId: string
): Promise<ActionResult> {
  try {
    if (!(await verifyChapterOwnership(journeyId, chapterId))) {
      return { success: false, error: "Chapter not found" };
    }

    const result = await prisma.media.updateMany({
      where: { id: mediaId, chapterId },
      data: { chapterId: null, role: "GALLERY" },
    });

    if (result.count === 0) {
      return { success: false, error: "Media not found in this chapter" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to remove media from chapter" };
  }
}

export async function reorderChapterMedia(
  journeyId: string,
  chapterId: string,
  orderedMediaIds: string[]
): Promise<ActionResult> {
  try {
    if (!(await verifyChapterOwnership(journeyId, chapterId))) {
      return { success: false, error: "Chapter not found" };
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.media.findMany({
        where: { chapterId },
        select: { id: true },
      });
      const existingIds = existing.map((m) => m.id).sort();
      const expectedIds = [...orderedMediaIds].sort();

      if (
        existingIds.length !== expectedIds.length ||
        existingIds.some((id, index) => id !== expectedIds[index])
      ) {
        throw new MediaOperationError("Media list does not match chapter");
      }

      // Phase 1 — move every item to a negative temporary order to free the 0..n range
      // and avoid unique constraint collisions during the swap.
      for (let i = 0; i < orderedMediaIds.length; i += 1) {
        const result = await tx.media.updateMany({
          where: { id: orderedMediaIds[i], chapterId },
          data: { order: -(i + 1) },
        });
        if (result.count === 0) {
          throw new MediaOperationError("Media not found in this chapter");
        }
      }

      // Phase 2 — assign final sequential orders inside the same transaction.
      for (let i = 0; i < orderedMediaIds.length; i += 1) {
        const result = await tx.media.updateMany({
          where: { id: orderedMediaIds[i], chapterId },
          data: { order: i },
        });
        if (result.count === 0) {
          throw new MediaOperationError("Media not found in this chapter");
        }
      }
    });

    return { success: true };
  } catch (error) {
    if (error instanceof MediaOperationError) {
      return { success: false, error: error.message };
    }

    console.error("Reorder failed:", error);
    return { success: false, error: "Failed to reorder chapter media" };
  }
}

export async function updateChapterMediaAltText(
  journeyId: string,
  chapterId: string,
  mediaId: string,
  altText: string
): Promise<ActionResult> {
  try {
    if (!(await verifyChapterOwnership(journeyId, chapterId))) {
      return { success: false, error: "Chapter not found" };
    }

    const result = await prisma.media.updateMany({
      where: { id: mediaId, chapterId },
      data: { altText: altText || null },
    });

    if (result.count === 0) {
      return { success: false, error: "Media not found in this chapter" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to update media alt text" };
  }
}

export async function deleteMediaPermanently(
  journeyId: string,
  chapterId: string,
  mediaId: string
): Promise<ActionResult> {
  try {
    if (!(await verifyChapterOwnership(journeyId, chapterId))) {
      return { success: false, error: "Chapter not found" };
    }

    const media = await prisma.media.findFirst({
      where: { id: mediaId, chapterId },
    });
    if (!media) {
      return { success: false, error: "Media not found in this chapter" };
    }

    if (media.providerId) {
      const deleted = await cloudinaryProvider.delete(media.providerId, media.type);
      if (!deleted) {
        console.warn("Storage cleanup returned false for:", media.providerId);
      }
    }

    await prisma.media.delete({ where: { id: mediaId } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete media" };
  }
}
