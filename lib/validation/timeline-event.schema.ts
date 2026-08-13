import { z } from "zod";

const dateStringToDate = z.preprocess(
  (val) => {
    if (typeof val === "string" || val instanceof Date) return new Date(val);
    return val;
  },
  z.date()
);

export const createTimelineEventSchema = z.object({
  date: dateStringToDate,
  title: z.string().min(1, "Title is required"),
  description: z.string().max(2000).optional(),
});

export const updateTimelineEventSchema = z.object({
  timelineEventId: z.string().min(1),
  date: dateStringToDate,
  title: z.string().min(1, "Title is required"),
  description: z.string().max(2000).optional(),
});

export const deleteTimelineEventSchema = z.object({
  timelineEventId: z.string().min(1),
});

export const reorderTimelineEventsSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1),
});

export type CreateTimelineEventInput = z.infer<typeof createTimelineEventSchema>;
export type UpdateTimelineEventInput = z.infer<typeof updateTimelineEventSchema>;
export type DeleteTimelineEventInput = z.infer<typeof deleteTimelineEventSchema>;
export type ReorderTimelineEventsInput = z.infer<typeof reorderTimelineEventsSchema>;
