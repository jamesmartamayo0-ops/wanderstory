import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().max(5000).optional().or(z.literal("")),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().max(5000).optional().or(z.literal("")),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;