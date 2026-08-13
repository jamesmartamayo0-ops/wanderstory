import { z } from "zod";
import { JourneyVisibility } from "../../app/generated/prisma/enums";

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
  introduction: z.string().min(1, "Introduction is required").max(20000),
  clientId: z.string().min(1, "Client is required"),
  destinationId: z.string().min(1, "Destination is required"),
  categoryIds: z.array(z.string()).optional().default([]),
});

export const updateJourneySchema = z.object({
  title: z.string().min(1).optional(),
  travelerName: z.string().min(1).optional(),
  travelStartDate: dateStringToDate.optional(),
  travelEndDate: dateStringToDate.optional(),
  introduction: z.string().min(1).max(20000).optional(),
  clientId: z.string().min(1).optional(),
  destinationId: z.string().min(1).optional(),
  categoryIds: z.array(z.string()).optional(),
  coverMediaId: z.string().optional().or(z.literal("")),
  ogImageId: z.string().optional().or(z.literal("")),
  visibility: z.nativeEnum(JourneyVisibility).optional(),
});

export const autosaveJourneySchema = updateJourneySchema;

export type CreateJourneyInput = z.infer<typeof createJourneySchema>;
export type UpdateJourneyInput = z.infer<typeof updateJourneySchema>;
export type AutosaveJourneyInput = z.infer<typeof autosaveJourneySchema>;