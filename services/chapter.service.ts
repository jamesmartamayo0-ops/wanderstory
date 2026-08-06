import prisma from "../lib/prisma";
import { cloudinaryProvider } from "./storage/cloudinary.provider";
import type { ActionResult } from "../types";

export async function verifyChapterOwnership(
  journeyId: string,
  chapterId: string
): Promise<boolean> {
  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, journeyId },
    select: { id: true },
  });

  return chapter !== null;
}

export async function getChaptersByJourney(journeyId: string) {
  return prisma.chapter.findMany({
    where: { journeyId },
    include: {
      media: { orderBy: { order: "asc" } },
    },
    orderBy: { order: "asc" },
  });
}

export async function createChapter(
  journeyId: string,
  data: { title: string; content: string }
): Promise<ActionResult> {
  try {
    const maxOrder = await prisma.chapter.aggregate({
      where: { journeyId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? 0) + 1;

    const chapter = await prisma.chapter.create({
      data: {
        journeyId,
        title: data.title,
        content: data.content,
        order: nextOrder,
      },
    });

    return { success: true, data: chapter };
  } catch {
    return { success: false, error: "Failed to create chapter" };
  }
}

export async function updateChapter(
  journeyId: string,
  chapterId: string,
  data: { title: string; content: string }
): Promise<ActionResult> {
  try {
    const result = await prisma.chapter.updateMany({
      where: { id: chapterId, journeyId },
      data: { title: data.title, content: data.content },
    });

    if (result.count === 0) {
      return { success: false, error: "Chapter not found" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to update chapter" };
  }
}

export async function deleteChapter(
  journeyId: string,
  chapterId: string
): Promise<ActionResult> {
  try {
    if (!(await verifyChapterOwnership(journeyId, chapterId))) {
      return { success: false, error: "Chapter not found" };
    }

    // Collect Cloudinary provider IDs before the database cascade removes media rows.
    const media = await prisma.media.findMany({
      where: { chapterId },
      select: { providerId: true },
    });

    const result = await prisma.chapter.deleteMany({
      where: { id: chapterId, journeyId },
    });

    if (result.count === 0) {
      return { success: false, error: "Chapter not found" };
    }

    // Best-effort storage cleanup; failures are non-fatal.
    for (const item of media) {
      if (!item.providerId) continue;
      try {
        await cloudinaryProvider.delete(item.providerId);
      } catch {
        // ignore — orphan asset will be handled by a future cleanup task
      }
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete chapter" };
  }
}