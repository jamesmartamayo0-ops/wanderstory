"use server";

import { requirePermission } from "@/lib/authz";
import { auditFromRequest } from "@/lib/audit";
import { revalidateJourneyPaths } from "@/lib/revalidate";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createJourneySchema,
  updateJourneySchema,
  autosaveJourneySchema,
} from "@/lib/validation/journey.schema";
import { statusTransitionSchema } from "@/lib/validation/status.schema";
import * as journeyService from "@/services/journey.service";
import type { ActionResult } from "@/types";

function forbidden(authz: { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }): ActionResult {
  return {
    success: false,
    error: authz.reason === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
  };
}

export async function createJourney(formData: FormData): Promise<ActionResult> {
  const authz = await requirePermission("journey:create");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const categoryIdsRaw = formData.getAll("categoryIds");
  const parsed = createJourneySchema.safeParse({
    title: formData.get("title"),
    travelerName: formData.get("travelerName"),
    travelStartDate: formData.get("travelStartDate"),
    travelEndDate: formData.get("travelEndDate"),
    introduction: formData.get("introduction"),
    clientId: formData.get("clientId"),
    destinationId: formData.get("destinationId"),
    categoryIds: categoryIdsRaw.length ? categoryIdsRaw : [],
    location: formData.get("location"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await journeyService.createJourney({
    ...parsed.data,
    authorId: authz.actor.id,
  });

  if (result.success && result.data) {
    const journey = result.data as { id: string };
    await auditFromRequest({
      eventType: "JOURNEY_CREATED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "JOURNEY",
      targetId: journey.id,
    });
    revalidatePath("/admin/journeys");
    redirect(`/admin/journeys/${journey.id}`);
  }

  return result;
}

export async function updateJourney(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("journey:update", {
    targetType: "JOURNEY",
    targetId: id,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const categoryIdsRaw = formData.getAll("categoryIds");
  const parsed = updateJourneySchema.safeParse({
    title: formData.get("title"),
    travelerName: formData.get("travelerName"),
    travelStartDate: formData.get("travelStartDate"),
    travelEndDate: formData.get("travelEndDate"),
    introduction: formData.get("introduction"),
    clientId: formData.get("clientId"),
    destinationId: formData.get("destinationId"),
    categoryIds: categoryIdsRaw.length ? categoryIdsRaw : undefined,
    coverMediaId: formData.get("coverMediaId"),
    ogImageId: formData.get("ogImageId"),
    location: formData.get("location"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await journeyService.updateJourney(id, parsed.data);
  if (result.success) {
    await auditFromRequest({
      eventType: "JOURNEY_UPDATED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "JOURNEY",
      targetId: id,
    });
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function deleteJourney(id: string): Promise<ActionResult> {
  const authz = await requirePermission("journey:delete", {
    targetType: "JOURNEY",
    targetId: id,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await journeyService.deleteJourney(id);
  if (result.success) {
    await auditFromRequest({
      eventType: "JOURNEY_DELETED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "JOURNEY",
      targetId: id,
    });
    revalidateJourneyPaths(
      id,
      result.data
        ? {
            journeySlug: result.data.slug,
            destinationSlug: result.data.destinationSlug,
          }
        : undefined
    );
    revalidatePath("/sitemap.xml");
  }
  return result;
}

export async function updateJourneyStatus(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = statusTransitionSchema.safeParse({
    newStatus: formData.get("newStatus"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const permission =
    parsed.data.newStatus === "PUBLISHED"
      ? "journey:publish"
      : parsed.data.newStatus === "ARCHIVED"
        ? "journey:archive"
        : "journey:update";

  const authz = await requirePermission(permission, {
    targetType: "JOURNEY",
    targetId: id,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await journeyService.updateJourneyStatus(
    id,
    parsed.data.newStatus
  );
  if (result.success) {
    await auditFromRequest({
      eventType: "JOURNEY_UPDATED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "JOURNEY",
      targetId: id,
      metadata: { status: parsed.data.newStatus },
    });
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function toggleJourneyFeatured(
  id: string
): Promise<ActionResult> {
  const authz = await requirePermission("journey:feature", {
    targetType: "JOURNEY",
    targetId: id,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await journeyService.toggleFeatured(id);
  if (result.success) {
    await auditFromRequest({
      eventType: "JOURNEY_UPDATED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "JOURNEY",
      targetId: id,
    });
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function updateJourneyVisibility(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = updateJourneySchema.safeParse({
    visibility: formData.get("visibility"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!parsed.data.visibility) {
    return {
      success: false,
      error: "Validation failed",
    };
  }

  const authz = await requirePermission("journey:visibility", {
    targetType: "JOURNEY",
    targetId: id,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await journeyService.updateJourneyVisibility(
    id,
    parsed.data.visibility
  );
  if (result.success) {
    await auditFromRequest({
      eventType: "JOURNEY_UPDATED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "JOURNEY",
      targetId: id,
      metadata: { visibility: parsed.data.visibility },
    });
    revalidatePath("/admin/journeys");
    revalidatePath(`/admin/journeys/${id}`);
    revalidatePath("/journeys");
    revalidatePath("/journeys/[slug]", "page");
    revalidatePath("/sitemap.xml");
  }
  return result;
}

export async function updatePublicationConsent(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const authz = await requirePermission("consent:update", {
    targetType: "JOURNEY",
    targetId: journeyId,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const consentGiven = formData.get("consentGiven") === "true";
  const clientId = formData.get("consentClientId") as string;
  const notes = formData.get("consentNotes") as string | null;

  if (!clientId) {
    return { success: false, error: "Client is required" };
  }

  const result = await journeyService.updatePublicationConsent(journeyId, {
    consentGiven,
    clientId,
    notes: notes || undefined,
  });

  if (result.success) {
    await auditFromRequest({
      eventType: "PUBLICATION_CONSENT_CHANGED",
      actorEmail: authz.actor.email,
      actorId: authz.actor.id,
      targetType: "JOURNEY",
      targetId: journeyId,
      metadata: { consentGiven, clientId },
    });
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function autosaveJourney(
  id: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  const authz = await requirePermission("journey:autosave", {
    targetType: "JOURNEY",
    targetId: id,
  });
  if (!authz.ok) {
    return forbidden(authz);
  }

  const parsed = autosaveJourneySchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await journeyService.updateJourney(id, parsed.data);
  return result;
}
