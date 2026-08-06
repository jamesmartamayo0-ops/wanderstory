import { z } from "zod";

export const attachChapterMediaSchema = z.object({
  chapterId: z.string().min(1),
  mediaIds: z.array(z.string().min(1)).min(1, "Select at least one media item"),
});

export const removeChapterMediaSchema = z.object({
  chapterId: z.string().min(1),
  mediaId: z.string().min(1),
});

export const deleteChapterMediaSchema = z.object({
  chapterId: z.string().min(1),
  mediaId: z.string().min(1),
});

export const reorderChapterMediaSchema = z.object({
  chapterId: z.string().min(1),
  mediaIds: z.array(z.string().min(1)).min(1),
});

export type AttachChapterMediaInput = z.infer<typeof attachChapterMediaSchema>;
export type RemoveChapterMediaInput = z.infer<typeof removeChapterMediaSchema>;
export type DeleteChapterMediaInput = z.infer<typeof deleteChapterMediaSchema>;
export type ReorderChapterMediaInput = z.infer<typeof reorderChapterMediaSchema>;