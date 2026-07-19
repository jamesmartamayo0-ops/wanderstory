import prisma from "../lib/prisma";
import { generateSlug, ensureUniqueSlug } from "../lib/slug";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../lib/validation/category.schema";
import type { ActionResult } from "../types";

export async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { journeys: true } } },
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export async function createCategory(
  data: CreateCategoryInput
): Promise<ActionResult> {
  try {
    const baseSlug = generateSlug(data.name);
    const slug = await ensureUniqueSlug(baseSlug, (s) =>
      prisma.category.findUnique({ where: { slug: s } })
    );

    const category = await prisma.category.create({
      data: { ...data, slug },
    });
    return { success: true, data: category };
  } catch {
    return { success: false, error: "Failed to create category" };
  }
}

export async function updateCategory(
  id: string,
  data: UpdateCategoryInput
): Promise<ActionResult> {
  try {
    const updateData: Record<string, unknown> = { ...data };

    if (data.name) {
      const baseSlug = generateSlug(data.name);
      updateData.slug = await ensureUniqueSlug(baseSlug, (s) =>
        prisma.category.findUnique({ where: { slug: s } }),
        id
      );
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });
    return { success: true, data: category };
  } catch {
    return { success: false, error: "Failed to update category" };
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    await prisma.category.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete category" };
  }
}