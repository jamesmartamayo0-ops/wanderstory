"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createClientSchema,
  updateClientSchema,
} from "@/lib/validation/client.schema";
import * as clientService from "@/services/client.service";
import type { ActionResult } from "@/types";

export async function createClient(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createClientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await clientService.createClient(parsed.data);
  if (result.success) {
    revalidatePath("/admin/clients");
  }
  return result;
}

export async function updateClient(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = updateClientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await clientService.updateClient(id, parsed.data);
  if (result.success) {
    revalidatePath("/admin/clients");
  }
  return result;
}

export async function deleteClient(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await clientService.deleteClient(id);
  if (result.success) {
    revalidatePath("/admin/clients");
  }
  return result;
}