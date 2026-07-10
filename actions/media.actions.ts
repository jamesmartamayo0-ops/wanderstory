"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fileTypeFromBuffer } from "file-type";
import {
  getAllowedMimeTypes,
  getMaxSize,
  getMediaType,
  updateMediaSchema,
} from "@/lib/validation/media.schema";
import * as mediaService from "@/services/media.service";
import type { ActionResult } from "@/types";

export async function uploadMedia(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
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

  const result = await mediaService.uploadMedia(buffer, {
    fileName: name,
    mimeType: actualMime,
    size: file.size,
    format: ext,
    type: getMediaType(actualMime),
    uploaderId: session.user.id,
  });

  if (result.success) {
    revalidatePath("/admin/media");
    redirect("/admin/media");
  }

  return result;
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await mediaService.deleteMedia(id);
  if (result.success) {
    revalidatePath("/admin/media");
  }
  return result;
}

export async function updateMedia(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
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