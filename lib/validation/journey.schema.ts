import { z } from "zod";

const dateStringToDate = z.preprocess(
  (val) => {
    if (typeof val === "string" || val instanceof Date) return new Date(val);
    return val;
  },
  z.date()
);

export const createJourneySchema = z.object({
  title: z.string().min(1, "Title is required"),
  travelerName: z.string().min(1, "Traveler name is required"),
  travelStartDate: dateStringToDate,
  travelEndDate: dateStringToDate,
  introduction: z.string().min(1, "Introduction is required"),
  clientId: z.string().min(1, "Client is required"),
  destinationId: z.string().min(1, "Destination is required"),
  categoryIds: z.array(z.string()).optional().default([]),
});

export const updateJourneySchema = z.object({
  title: z.string().min(1).optional(),
  travelerName: z.string().min(1).optional(),
  travelStartDate: dateStringToDate.optional(),
  travelEndDate: dateStringToDate.optional(),
  introduction: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  destinationId: z.string().min(1).optional(),
  categoryIds: z.array(z.string()).optional(),
  coverMediaId: z.string().optional().or(z.literal("")),
  ogImageId: z.string().optional().or(z.literal("")),
});

export const autosaveJourneySchema = updateJourneySchema;

export type CreateJourneyInput = z.infer<typeof createJourneySchema>;
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>;
export type AutosaveJourneyInput = z.infer<typeof autosaveJourneySchema>;