import { z } from "zod";

export const createChapterSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required").max(50000),
  location: z.string().max(200).optional().or(z.literal("")),
});

export const updateChapterSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required").max(50000),
  location: z.string().max(200).optional().or(z.literal("")),
});

export const deleteChapterSchema = z.object({
  chapterId: z.string().min(1),
});

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;