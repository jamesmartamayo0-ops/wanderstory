import prisma from "../lib/prisma";
import { cloudinaryProvider } from "./storage/cloudinary.provider";
import { verifyChapterOwnership } from "./chapter.service";
import type { UploadResult } from "./storage/storage.types";
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

export async function uploadMedia(
  file: Buffer,
  metadata: {
    fileName: string;
    mimeType: string;
    size: number;
    format: string;
    type: string;
    uploaderId: string;
  }
): Promise<ActionResult> {
  let uploadResult: UploadResult | null = null;

  try {
    uploadResult = await cloudinaryProvider.upload(file, {
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      folder: "wanderstory",
    });

    const media = await prisma.media.create({
      data: {
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        type: metadata.type as "IMAGE" | "VIDEO" | "DOCUMENT",
        format: uploadResult.format ?? metadata.format,
        width: uploadResult.width ?? null,
        height: uploadResult.height ?? null,
        duration: uploadResult.duration ?? null,
        provider: "CLOUDINARY",
        providerId: uploadResult.providerId,
        url: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl ?? null,
        blurDataUrl: uploadResult.blurDataUrl ?? null,
        role: "GALLERY",
        uploaderId: metadata.uploaderId,
      },
    });

    return { success: true, data: media };
  } catch (error) {
    console.error("Upload failed:", error);

    if (uploadResult?.providerId) {
      try {
        await cloudinaryProvider.delete(uploadResult.providerId);
      } catch {
        // cleanup failure is non-fatal; original error takes priority
      }
    }

    return { success: false, error: "Failed to upload media" };
  }
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  try {
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) {
      return { success: false, error: "Media not found" };
    }

    if (media.providerId) {
      const deleted = await cloudinaryProvider.delete(media.providerId);
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
  providerIds: Array<string | null>
): Promise<void> {
  for (const providerId of providerIds) {
    if (!providerId) continue;
    try {
      await cloudinaryProvider.delete(providerId);
    } catch {
      // best-effort storage cleanup; failures are non-fatal
    }
  }
}

export async function uploadChapterMedia(
  file: Buffer,
  metadata: {
    journeyId: string;
    chapterId: string;
    fileName: string;
    mimeType: string;
    size: number;
    format: string;
    type: string;
    uploaderId: string;
  }
): Promise<ActionResult> {
  if (!(await verifyChapterOwnership(metadata.journeyId, metadata.chapterId))) {
    return { success: false, error: "Chapter not found" };
  }

  let uploadResult: UploadResult | null = null;

  try {
    const maxOrder = await prisma.media.aggregate({
      where: { chapterId: metadata.chapterId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? -1) + 1;

    uploadResult = await cloudinaryProvider.upload(file, {
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      folder: "wanderstory",
    });

    const media = await prisma.media.create({
      data: {
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        type: metadata.type as "IMAGE" | "VIDEO" | "DOCUMENT",
        format: uploadResult.format ?? metadata.format,
        width: uploadResult.width ?? null,
        height: uploadResult.height ?? null,
        duration: uploadResult.duration ?? null,
        provider: "CLOUDINARY",
        providerId: uploadResult.providerId,
        url: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl ?? null,
        blurDataUrl: uploadResult.blurDataUrl ?? null,
        role: "CHAPTER",
        chapterId: metadata.chapterId,
        order: nextOrder,
        uploaderId: metadata.uploaderId,
      },
    });

    return { success: true, data: media };
  } catch (error) {
    console.error("Upload failed:", error);

    if (uploadResult?.providerId) {
      try {
        await cloudinaryProvider.delete(uploadResult.providerId);
      } catch {
        // cleanup failure is non-fatal; original error takes priority
      }
    }

    return { success: false, error: "Failed to upload chapter media" };
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
      const deleted = await cloudinaryProvider.delete(media.providerId);
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