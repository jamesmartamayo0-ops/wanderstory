"use server";

import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validation/category.schema";
import * as categoryService from "@/services/category.service";
import type { ActionResult } from "@/types";

export async function saveCategory(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const id = formData.get("id") as string | null;

  if (id) {
    const parsed = updateCategorySchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description"),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const result = await categoryService.updateCategory(id, parsed.data);
    if (result.success) {
      revalidatePath("/admin/categories");
    }
    return result;
  }

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const result = await categoryService.createCategory(parsed.data);
  if (result.success) {
    revalidatePath("/admin/categories");
  }
  return result;
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Unauthorized" };
  }

  const result = await categoryService.deleteCategory(id);
  if (result.success) {
    revalidatePath("/admin/categories");
  }
  return result;
}