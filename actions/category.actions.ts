"use server";

import { requirePermission } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validation/category.schema";
import * as categoryService from "@/services/category.service";
import type { ActionResult } from "@/types";

function forbidden(authz: { ok: false; reason: "UNAUTHORIZED" | "FORBIDDEN" }): ActionResult {
  return {
    success: false,
    error: authz.reason === "FORBIDDEN" ? "Forbidden" : "Unauthorized",
  };
}

export async function saveCategory(formData: FormData): Promise<ActionResult> {
  const id = formData.get("id") as string | null;

  const authz = await requirePermission(id ? "category:update" : "category:create");
  if (!authz.ok) {
    return forbidden(authz);
  }

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
  const authz = await requirePermission("category:delete");
  if (!authz.ok) {
    return forbidden(authz);
  }

  const result = await categoryService.deleteCategory(id);
  if (result.success) {
    revalidatePath("/admin/categories");
  }
  return result;
}
