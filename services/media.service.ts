import prisma from "../lib/prisma";
import { cloudinaryProvider } from "./storage/cloudinary.provider";
import type { UploadResult } from "./storage/storage.types";
import type { UpdateMediaInput, MediaFilterInput } from "../lib/validation/media.schema";
import type { ActionResult } from "../types";

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
    if (uploadResult?.providerId) {
      try {
        await cloudinaryProvider.delete(uploadResult.providerId);
      } catch {
        // cleanup failure is non-fatal; original error takes priority
      }
    }

    const message = error instanceof Error ? error.message : "Failed to upload media";
    return { success: false, error: message };
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