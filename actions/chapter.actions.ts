"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createChapterSchema,
  updateChapterSchema,
  deleteChapterSchema,
} from "@/lib/validation/chapter.schema";
import * as chapterService from "@/services/chapter.service";
import type { ActionResult } from "@/types";

export async function createChapter(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
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
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
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
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

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

  const result = await chapterService.deleteChapter(
    journeyId,
    parsed.data.chapterId
  );
  if (result.success) {
    revalidatePath("/admin/journeys");
    revalidatePath(`/admin/journeys/${journeyId}`);
  }
  return result;
}