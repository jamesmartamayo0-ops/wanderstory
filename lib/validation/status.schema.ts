import { z } from "zod";
import { JourneyStatus } from "../../app/generated/prisma/enums";

export const statusTransitionSchema = z.object({
  newStatus: z.nativeEnum(JourneyStatus),
});

export type StatusTransitionInput = z.infer<typeof statusTransitionSchema>;