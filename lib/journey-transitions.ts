import { JourneyStatus } from "../app/generated/prisma/enums";

export type JourneyStatusValue = (typeof JourneyStatus)[keyof typeof JourneyStatus];

export const allowedTransitions: Record<JourneyStatusValue, JourneyStatusValue[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["DRAFT", "APPROVED"],
  APPROVED: ["PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};
