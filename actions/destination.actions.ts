"use server";

import { requirePermission } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import {
  createDestinationSchema,
  updateDestinationSchema,
} from "@/lib/validation/destination.schema";
import * as destinationService from "@/services/destination.service";
import type { ActionResult } from "@/types";

function forbidden(authz: { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }): ActionResult {
  return {
    success: false,
    error: authz.reason === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
  };
}

export async function saveDestination(formData: FormData): Promise<ActionResult> {
  const id = formData.get("id") as string | null;

  const authz = await requirePermission(
    id ? "destination:update" : "destination:create"
  );
  if (!authz.ok) {
    return forbidden(authz);
  }

  if (id) {
    const parsed = updateDestinationSchema.safeParse({
      name: formData.get("name"),
      country: formData.get("country"),
      continent: formData.get("continent"),
      featuredPlace: formData.get("featuredPlace"),
      region: formData.get("region"),
      description: formData.get("description"),
      heroMediaId: formData.get("heroMediaId"),
      featured: formData.get("featured") === "true",
      published: formData.get("published") === "true",
    });

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const result = await destinationService.updateDestination(id, parsed.data);
    if (result.success) {
      revalidatePath("/admin/destinations");
      revalidatePath("/destinations");
      revalidatePath("/");
      revalidatePath("/destinations/[slug]");
      revalidatePath("/sitemap.xml");
      revalidatePath("/destinations/search-index");
    }
    return result;
  }

  const parsed = createDestinationSchema.safeParse({
    name: formData.get("name"),
    country: formData.get("country"),
    continent: formData.get("continent"),
    featuredPlace: formData.get("featuredPlace"),
    region: formData.get("region"),
    description: formData.get("description"),
    featured: formData.get("featured") === "true",
    published: formData.get("published") === "true",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await destinationService.createDestination(parsed.data);
  if (result.success) {
    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    revalidatePath("/");
    revalidatePath("/destinations/[slug]");
    revalidatePath("/sitemap.xml");
      revalidatePath("/destinations/search-index");
  }
  return result;
}

export async function deleteDestination(id: string): Promise<ActionResult> {
  const authz = await requirePermission("destination:delete");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await destinationService.deleteDestination(id);
  if (result.success) {
    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    revalidatePath("/");
    revalidatePath("/destinations/[slug]");
    revalidatePath("/sitemap.xml");
      revalidatePath("/destinations/search-index");
  }
  return result;
}

export async function updateDestinationPublished(
  id: string,
  published: boolean
): Promise<ActionResult> {
  const authz = await requirePermission("destination:publish");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await destinationService.updateDestinationPublished(
    id,
    published
  );
  if (result.success) {
    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    revalidatePath("/");
    revalidatePath("/destinations/[slug]");
    revalidatePath("/sitemap.xml");
      revalidatePath("/destinations/search-index");
  }
  return result;
}
