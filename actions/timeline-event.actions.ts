"use server";

import { requirePermission } from "@/lib/authz";
import { auditFromRequest } from "@/lib/audit";
import { revalidateJourneyPaths } from "@/lib/revalidate";
import {
  createTimelineEventSchema,
  updateTimelineEventSchema,
  deleteTimelineEventSchema,
  reorderTimelineEventsSchema,
} from "@/lib/validation/timeline-event.schema";
import * as timelineEventService from "@/services/timeline-event.service";
import type { ActionResult } from "@/types";

function forbidden(authz: { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }): ActionResult {
  return {
    success: false,
    error: authz.reason === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
  };
}

export async function createTimelineEvent(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("timeline:create");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const parsed = createTimelineEventSchema.safeParse({
    date: formData.get("date"),
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await timelineEventService.createTimelineEvent(
    journeyId,
    parsed.data
  );

  if (result.success) {
    const event = result.data as { id?: string };
    await auditFromRequest({
      eventType: "TIMELINE_EVENT_CREATED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "TIMELINE_EVENT",
      targetId: event?.id ?? null,
      metadata: { journeyId },
    });
    revalidateJourneyPaths(journeyId);
  }
  return result;
}

export async function updateTimelineEvent(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("timeline:update");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const parsed = updateTimelineEventSchema.safeParse({
    timelineEventId: formData.get("timelineEventId"),
    date: formData.get("date"),
    title: formData.get("title"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await timelineEventService.updateTimelineEvent(
    journeyId,
    parsed.data.timelineEventId,
    {
      date: parsed.data.date,
      title: parsed.data.title,
      description: parsed.data.description,
    }
  );

  if (result.success) {
    await auditFromRequest({
      eventType: "TIMELINE_EVENT_UPDATED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "TIMELINE_EVENT",
      targetId: parsed.data.timelineEventId,
      metadata: { journeyId },
    });
    revalidateJourneyPaths(journeyId);
  }
  return result;
}

export async function deleteTimelineEvent(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = deleteTimelineEventSchema.safeParse({
    timelineEventId: formData.get("timelineEventId"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const authz = await requirePermission("timeline:delete", {
    targetType: "TIMELINE_EVENT",
    targetId: parsed.data.timelineEventId,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await timelineEventService.deleteTimelineEvent(
    journeyId,
    parsed.data.timelineEventId
  );

  if (result.success) {
    await auditFromRequest({
      eventType: "TIMELINE_EVENT_DELETED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "TIMELINE_EVENT",
      targetId: parsed.data.timelineEventId,
      metadata: { journeyId },
    });
    revalidateJourneyPaths(journeyId);
  }
  return result;
}

export async function reorderTimelineEvents(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("timeline:reorder");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const eventIds = formData.getAll("eventIds").map(String);

  const parsed = reorderTimelineEventsSchema.safeParse({
    eventIds,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await timelineEventService.reorderTimelineEvents(
    journeyId,
    parsed.data.eventIds
  );

  if (result.success) {
    revalidateJourneyPaths(journeyId);
  }
  return result;
}
