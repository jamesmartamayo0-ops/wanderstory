import { z } from "zod";
import {
  SocialDraftStatus,
  SocialPlatform,
} from "../../app/generated/prisma/enums";

export const SOCIAL_DRAFT_CAPTION_MAX_LENGTH = 5000;

const unsupportedControlCharacters =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function normalizeSocialDraftCaption(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export const socialDraftCaptionSchema = z
  .string()
  .transform(normalizeSocialDraftCaption)
  .pipe(
    z
      .string()
      .max(
        SOCIAL_DRAFT_CAPTION_MAX_LENGTH,
        `Caption must be ${SOCIAL_DRAFT_CAPTION_MAX_LENGTH} characters or fewer`,
      )
      .refine(
        (value) => !unsupportedControlCharacters.test(value),
        "Caption contains unsupported control characters",
      ),
  );

export const readySocialDraftCaptionSchema = socialDraftCaptionSchema.refine(
  (value) => value.length > 0,
  "Caption is required before marking a draft ready",
);

const idSchema = z.string().min(1);

const updatedAtSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" || value instanceof Date) {
      return new Date(value);
    }
    return value;
  },
  z.date(),
);

export const createSocialDraftSchema = z
  .object({
    journeyId: idSchema,
    platform: z.nativeEnum(SocialPlatform),
    caption: socialDraftCaptionSchema.default(""),
    mediaId: idSchema.nullable().optional(),
  })
  .strict();

export const updateSocialDraftSchema = z
  .object({
    journeyId: idSchema,
    draftId: idSchema,
    caption: socialDraftCaptionSchema.optional(),
    mediaId: idSchema.nullable().optional(),
    updatedAt: updatedAtSchema,
  })
  .strict()
  .refine(
    (value) => value.caption !== undefined || value.mediaId !== undefined,
    "At least one editable field is required",
  );

export const transitionSocialDraftStatusSchema = z
  .object({
    journeyId: idSchema,
    draftId: idSchema,
    targetStatus: z.nativeEnum(SocialDraftStatus),
    updatedAt: updatedAtSchema,
  })
  .strict();

export const deleteSocialDraftSchema = z
  .object({
    journeyId: idSchema,
    draftId: idSchema,
  })
  .strict();

export type CreateSocialDraftInput = z.infer<typeof createSocialDraftSchema>;
export type UpdateSocialDraftInput = z.infer<typeof updateSocialDraftSchema>;
export type TransitionSocialDraftStatusInput = z.infer<
  typeof transitionSocialDraftStatusSchema
>;
export type DeleteSocialDraftInput = z.infer<typeof deleteSocialDraftSchema>;
