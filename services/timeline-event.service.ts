import prisma from "../lib/prisma";
import type { ActionResult } from "../types";

class TimelineEventOperationError extends Error {}

export async function verifyTimelineEventOwnership(
  journeyId: string,
  eventId: string
): Promise<boolean> {
  const event = await prisma.timelineEvent.findFirst({
    where: { id: eventId, journeyId },
    select: { id: true },
  });

  return event !== null;
}

export async function getTimelineEventsByJourney(journeyId: string) {
  return prisma.timelineEvent.findMany({
    where: { journeyId },
    orderBy: { order: "asc" },
  });
}

export async function createTimelineEvent(
  journeyId: string,
  data: { date: Date; title: string; description?: string }
): Promise<ActionResult> {
  try {
    const journey = await prisma.journey.findFirst({
      where: { id: journeyId },
      select: { id: true },
    });

    if (!journey) {
      return { success: false, error: "Journey not found" };
    }

    const maxOrder = await prisma.timelineEvent.aggregate({
      where: { journeyId },
      _max: { order: true },
    });
    const nextOrder = (maxOrder._max.order ?? 0) + 1;

    const event = await prisma.timelineEvent.create({
      data: {
        journeyId,
        date: data.date,
        title: data.title,
        description: data.description || null,
        order: nextOrder,
      },
    });

    return { success: true, data: event };
  } catch {
    return { success: false, error: "Failed to create timeline event" };
  }
}

export async function updateTimelineEvent(
  journeyId: string,
  eventId: string,
  data: { date: Date; title: string; description?: string }
): Promise<ActionResult> {
  try {
    const result = await prisma.timelineEvent.updateMany({
      where: { id: eventId, journeyId },
      data: {
        date: data.date,
        title: data.title,
        description: data.description || null,
      },
    });

    if (result.count === 0) {
      return { success: false, error: "Timeline event not found" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to update timeline event" };
  }
}

export async function deleteTimelineEvent(
  journeyId: string,
  eventId: string
): Promise<ActionResult> {
  try {
    if (!(await verifyTimelineEventOwnership(journeyId, eventId))) {
      return { success: false, error: "Timeline event not found" };
    }

    const result = await prisma.timelineEvent.deleteMany({
      where: { id: eventId, journeyId },
    });

    if (result.count === 0) {
      return { success: false, error: "Timeline event not found" };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete timeline event" };
  }
}

export async function reorderTimelineEvents(
  journeyId: string,
  orderedEventIds: string[]
): Promise<ActionResult> {
  try {
    const existing = await prisma.timelineEvent.findMany({
      where: { journeyId },
      select: { id: true },
    });
    const existingIds = existing.map((e) => e.id).sort();
    const expectedIds = [...orderedEventIds].sort();

    if (
      existingIds.length !== expectedIds.length ||
      existingIds.some((id, index) => id !== expectedIds[index])
    ) {
      throw new TimelineEventOperationError(
        "Timeline event list does not match journey"
      );
    }

    await prisma.$transaction(async (tx) => {
      // Phase 1 — move every item to a negative temporary order to free the 0..n range
      // and avoid unique constraint collisions during the swap.
      for (let i = 0; i < orderedEventIds.length; i += 1) {
        const result = await tx.timelineEvent.updateMany({
          where: { id: orderedEventIds[i], journeyId },
          data: { order: -(i + 1) },
        });
        if (result.count === 0) {
          throw new TimelineEventOperationError(
            "Timeline event not found in this journey"
          );
        }
      }

      // Phase 2 — assign final sequential orders inside the same transaction.
      for (let i = 0; i < orderedEventIds.length; i += 1) {
        const result = await tx.timelineEvent.updateMany({
          where: { id: orderedEventIds[i], journeyId },
          data: { order: i },
        });
        if (result.count === 0) {
          throw new TimelineEventOperationError(
            "Timeline event not found in this journey"
          );
        }
      }
    });

    return { success: true };
  } catch (error) {
    if (error instanceof TimelineEventOperationError) {
      return { success: false, error: error.message };
    }

    console.error("Reorder failed:", error);
    return { success: false, error: "Failed to reorder timeline events" };
  }
}
