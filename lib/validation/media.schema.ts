import { z } from "zod";
import { MediaType } from "@/app/generated/prisma/enums";

const MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "application/pdf",
] as const;

const maxSize = {
  image: 20 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
};

export function getAllowedMimeTypes(): string[] {
  return [...MIME_TYPES];
}

export function getMaxSize(mimeType: string): number {
  if (mimeType.startsWith("video/")) return maxSize.video;
  if (mimeType === "application/pdf") return maxSize.pdf;
  return maxSize.image;
}

export function getMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith("image/")) return MediaType.IMAGE;
  if (mimeType.startsWith("video/")) return MediaType.VIDEO;
  return MediaType.DOCUMENT;
}

export const updateMediaSchema = z.object({
  altText: z.string().optional().or(z.literal("")),
  role: z.enum(["COVER", "GALLERY", "CHAPTER", "DESTINATION_HERO", "OG_IMAGE"]).optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export type UpdateMediaInput = z.infer<typeof updateMediaSchema>;

export const mediaFilterSchema = z.object({
  search: z.string().optional(),
  type: z.nativeEnum(MediaType).optional(),
  role: z.string().optional(),
});

export type MediaFilterInput = z.infer<typeof mediaFilterSchema>;