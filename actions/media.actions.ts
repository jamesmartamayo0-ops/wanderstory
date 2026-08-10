"use server";

import { requirePermission } from "@/lib/authz";
import { auditFromRequest } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fileTypeFromBuffer } from "file-type";
import {
  getAllowedMimeTypes,
  getAllowedChapterMimeTypes,
  getMaxSize,
  getMediaType,
  updateMediaSchema,
} from "@/lib/validation/media.schema";
import {
  attachChapterMediaSchema,
  removeChapterMediaSchema,
  deleteChapterMediaSchema,
  reorderChapterMediaSchema,
} from "@/lib/validation/chapter-media.schema";
import * as mediaService from "@/services/media.service";
import type { ActionResult } from "@/types";

function forbidden(authz: { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }): ActionResult {
  return {
    success: false,
    error: authz.reason === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
  };
}

function revalidateJourneyPaths(journeyId: string) {
  revalidatePath("/admin/journeys");
  revalidatePath(`/admin/journeys/${journeyId}`);
  revalidatePath("/journeys");
  revalidatePath("/journeys/[slug]", "page");
}

export async function uploadMedia(formData: FormData): Promise<ActionResult> {
  const authz = await requirePermission("media:upload");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return { success: false, error: "No file provided" };
  }

  if (file.size === 0) {
    return { success: false, error: "File is empty" };
  }

  const mimeType = file.type || "application/octet-stream";
  const allowedMimeTypes = getAllowedMimeTypes();

  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      success: false,
      error: `Invalid file type: ${mimeType}. Allowed: ${allowedMimeTypes.join(", ")}`,
    };
  }

  const maxSize = getMaxSize(mimeType);
  if (file.size > maxSize) {
    return {
      success: false,
      error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`,
    };
  }

  const name = "name" in file && file.name ? file.name : "untitled";
  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";

  const buffer = Buffer.from(await file.arrayBuffer());

  const detected = await fileTypeFromBuffer(buffer);
  const actualMime = detected?.mime ?? mimeType;

  if (!allowedMimeTypes.includes(actualMime)) {
    return {
      success: false,
      error: `Invalid file type: ${actualMime}. Allowed: ${allowedMimeTypes.join(", ")}`,
    };
  }

  const result = await mediaService.uploadMedia(buffer, {
    fileName: name,
    mimeType: actualMime,
    size: file.size,
    format: ext,
    type: getMediaType(actualMime),
    uploaderId: authz.actor.id,
  });

  if (result.success) {
    const media = result.data as { id?: string };
    if (media?.id) {
      await auditFromRequest({
        eventType: "MEDIA_UPLOADED",
        actorEmail: authz.actor.email,
        actorId: authz.actor.id,
        targetType: "MEDIA",
        targetId: media.id,
      });
    }
    revalidatePath("/admin/media");
    redirect("/admin/media");
  }

  return result;
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

export async function uploadChapterMedia(
  journeyId: string,
  chapterId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("media:upload");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return { success: false, error: "No file provided" };
  }

  if (file.size === 0) {
    return { success: false, error: "File is empty" };
  }

  const mimeType = file.type || "application/octet-stream";
  const allowedMimeTypes = getAllowedChapterMimeTypes();

  if (!allowedMimeTypes.includes(mimeType)) {
    return {
      success: false,
      error: `Invalid file type: ${mimeType}. Allowed: ${allowedMimeTypes.join(", ")}`,
    };
  }

  const maxSize = getMaxSize(mimeType);
  if (file.size > maxSize) {
    return {
      success: false,
      error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`,
    };
  }

  const name = file.name || "untitled";
  const ext = name.includes(".") ? name.split(".").pop() ?? "" : "";

  const buffer = Buffer.from(await file.arrayBuffer());

  const detected = await fileTypeFromBuffer(buffer);
  const actualMime = detected?.mime ?? mimeType;

  if (!allowedMimeTypes.includes(actualMime)) {
    return {
      success: false,
      error: `Invalid file type: ${actualMime}. Allowed: ${allowedMimeTypes.join(", ")}`,
    };
  }

  const result = await mediaService.uploadChapterMedia(buffer, {
    journeyId,
    chapterId,
    fileName: name,
    mimeType: actualMime,
    size: file.size,
    format: ext,
    type: getMediaType(actualMime),
    uploaderId: authz.actor.id,
  });

  if (result.success) {
    const media = result.data as { id?: string };
    if (media?.id) {
      await auditFromRequest({
        eventType: "MEDIA_UPLOADED",
        actorEmail: authz.actor.email,
        actorId: authz.actor.id,
        targetType: "MEDIA",
        targetId: media.id,
        metadata: { journeyId, chapterId },
      });
    }
    revalidateJourneyPaths(journeyId);
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
