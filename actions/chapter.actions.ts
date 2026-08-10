"use server";

import { requirePermission } from "@/lib/authz";
import { auditFromRequest } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import {
  createChapterSchema,
  updateChapterSchema,
  deleteChapterSchema,
} from "@/lib/validation/chapter.schema";
import * as chapterService from "@/services/chapter.service";
import type { ActionResult } from "@/types";

function forbidden(authz: { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }): ActionResult {
  return {
    success: false,
    error: authz.reason === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
  };
}

export async function createChapter(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("chapter:create");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const parsed = createChapterSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await chapterService.createChapter(journeyId, parsed.data);
  if (result.success) {
    revalidatePath("/admin/journeys");
    revalidatePath(`/admin/journeys/${journeyId}`);
  }
  return result;
}

export async function updateChapter(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("chapter:update");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const parsed = updateChapterSchema.safeParse({
    chapterId: formData.get("chapterId"),
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await chapterService.updateChapter(
    journeyId,
    parsed.data.chapterId,
    { title: parsed.data.title, content: parsed.data.content }
  );
  if (result.success) {
    revalidatePath("/admin/journeys");
    revalidatePath(`/admin/journeys/${journeyId}`);
  }
  return result;
}

export async function deleteChapter(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = deleteChapterSchema.safeParse({
    chapterId: formData.get("chapterId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const authz = await requirePermission("chapter:delete", {
    targetType: "CHAPTER",
    targetId: parsed.data.chapterId,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await chapterService.deleteChapter(
    journeyId,
    parsed.data.chapterId
  );
  if (result.success) {
    await auditFromRequest({
      eventType: "CHAPTER_DELETED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "CHAPTER",
      targetId: parsed.data.chapterId,
      metadata: { journeyId },
    });
    revalidatePath("/admin/journeys");
    revalidatePath(`/admin/journeys/${journeyId}`);
  }
  return result;
}
