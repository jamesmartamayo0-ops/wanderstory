"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createDestinationSchema,
  updateDestinationSchema,
} from "@/lib/validation/destination.schema";
import * as destinationService from "@/services/destination.service";
import type { ActionResult } from "@/types";

export async function saveDestination(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const id = formData.get("id") as string | null;

  if (id) {
    const parsed = updateDestinationSchema.safeParse({
      name: formData.get("name"),
      country: formData.get("country"),
      region: formData.get("region"),
      description: formData.get("description"),
      heroMediaId: formData.get("heroMediaId"),
      featured: formData.get("featured") === "true",
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
    }
    return result;
  }

  const parsed = createDestinationSchema.safeParse({
    name: formData.get("name"),
    country: formData.get("country"),
    region: formData.get("region"),
    description: formData.get("description"),
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
  }
  return result;
}

export async function deleteDestination(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await destinationService.deleteDestination(id);
  if (result.success) {
    revalidatePath("/admin/destinations");
  }
  return result;
}