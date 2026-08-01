"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createJourneySchema,
  updateJourneySchema,
  autosaveJourneySchema,
} from "@/lib/validation/journey.schema";
import {
  createChapterSchema,
  updateChapterSchema,
  deleteChapterSchema,
} from "@/lib/validation/chapter.schema";
import { statusTransitionSchema } from "@/lib/validation/status.schema";
import * as journeyService from "@/services/journey.service";
import type { ActionResult } from "@/types";

export async function createJourney(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
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
    authorId: session.user.id,
  });

  if (result.success && result.data) {
    const journey = result.data as { id: string };
    revalidatePath("/admin/journeys");
    redirect(`/admin/journeys/${journey.id}/edit`);
  }

  return result;
}

export async function updateJourney(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
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
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function deleteJourney(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await journeyService.deleteJourney(id);
  if (result.success) {
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function updateJourneyStatus(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

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

  const result = await journeyService.updateJourneyStatus(
    id,
    parsed.data.newStatus
  );
  if (result.success) {
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function toggleJourneyFeatured(
  id: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await journeyService.toggleFeatured(id);
  if (result.success) {
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function updatePublicationConsent(
  journeyId: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
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
    revalidatePath("/admin/journeys");
  }
  return result;
}

export async function autosaveJourney(
  id: string,
  data: Record<string, unknown>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
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

  const result = await journeyService.createChapter(journeyId, parsed.data);
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

  const result = await journeyService.updateChapter(
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

  const result = await journeyService.deleteChapter(journeyId, parsed.data.chapterId);
  if (result.success) {
    revalidatePath("/admin/journeys");
    revalidatePath(`/admin/journeys/${journeyId}`);
  }
  return result;
}