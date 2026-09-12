import prisma from "../lib/prisma";
import { isTrustedJourneyImageMedia } from "../lib/journey-media-trust";
import {
  getSocialDraftPublishEligibility,
  type SocialDraftEligibilityResult,
} from "../lib/social-draft-eligibility";
import {
  createSocialDraftSchema,
  deleteSocialDraftSchema,
  readySocialDraftCaptionSchema,
  transitionSocialDraftStatusSchema,
  updateSocialDraftSchema,
} from "../lib/validation/social-draft.schema";

export type SocialDraftServiceErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ALREADY_ARCHIVED"
  | "INVALID_MEDIA"
  | "INVALID_TRANSITION"
  | "EDITORIAL_INCOMPLETE"
  | "READY_LOCKED"
  | "CONFLICT"
  | "OPERATION_FAILED";

export type SocialDraftServiceResult<T> =
  | { success: true; data: T }
  | { success: false; code: SocialDraftServiceErrorCode; error: string };

const socialDraftSelect = {
  id: true,
  journeyId: true,
  platform: true,
  caption: true,
  mediaId: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SocialMediaOwnershipFields = {
  journeyId: string | null;
  chapter: { journeyId: string } | null;
  journeyCover: { id: string } | null;
  journeyOgImage: { id: string } | null;
};

export function isSocialMediaAssociatedWithJourney(
  journeyId: string,
  media: SocialMediaOwnershipFields,
): boolean {
  return (
    media.journeyId === journeyId ||
    media.chapter?.journeyId === journeyId ||
    media.journeyCover?.id === journeyId ||
    media.journeyOgImage?.id === journeyId
  );
}

function failure<T>(
  code: SocialDraftServiceErrorCode,
  error: string,
): SocialDraftServiceResult<T> {
  return { success: false, code, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeConstraintField(value: unknown): string | null {
  if (typeof value !== "string") return null;

  return value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

function isSocialDraftUniqueConflict(error: unknown): boolean {
  if (!isRecord(error) || error.code !== "P2002" || !isRecord(error.meta)) {
    return false;
  }

  const meta = error.meta;
  const target = meta.target;

  if (
    (Array.isArray(target) &&
      target.length === 2 &&
      target.includes("journeyId") &&
      target.includes("platform")) ||
    target === "journeyId_platform" ||
    target === "SocialDraft_journeyId_platform_key"
  ) {
    return true;
  }

  if (meta.modelName !== "SocialDraft" || !isRecord(meta.driverAdapterError)) {
    return false;
  }

  const cause = meta.driverAdapterError.cause;
  if (
    !isRecord(cause) ||
    cause.kind !== "UniqueConstraintViolation" ||
    !isRecord(cause.constraint) ||
    !Array.isArray(cause.constraint.fields) ||
    cause.constraint.fields.length !== 2
  ) {
    return false;
  }

  const fields = cause.constraint.fields.map(normalizeConstraintField);
  return fields.includes("journeyId") && fields.includes("platform");
}

async function getMutableJourney(journeyId: string) {
  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
    select: { id: true, status: true },
  });

  if (!journey) {
    return failure<never>("NOT_FOUND", "Journey not found");
  }
  if (journey.status === "ARCHIVED") {
    return failure<never>(
      "ALREADY_ARCHIVED",
      "Archived journeys cannot be modified",
    );
  }

  return { success: true as const, data: journey };
}

async function isAssignableSocialMedia(
  journeyId: string,
  mediaId: string,
): Promise<boolean> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      provider: true,
      type: true,
      url: true,
      mimeType: true,
      journeyId: true,
      chapter: { select: { journeyId: true } },
      journeyCover: { select: { id: true } },
      journeyOgImage: { select: { id: true } },
    },
  });

  return Boolean(
    media &&
      isSocialMediaAssociatedWithJourney(journeyId, media) &&
      isTrustedJourneyImageMedia(media),
  );
}

async function classifyConditionalMutationFailure(
  journeyId: string,
  draftId: string,
  expectedUpdatedAt: Date,
  requiredStatus?: "DRAFT" | "READY",
): Promise<SocialDraftServiceResult<never>> {
  const current = await prisma.socialDraft.findFirst({
    where: { id: draftId, journeyId },
    select: { id: true, status: true, updatedAt: true },
  });

  if (!current) {
    return failure("NOT_FOUND", "Social draft not found");
  }
  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return failure(
      "CONFLICT",
      "Social draft changed since it was loaded",
    );
  }
  if (requiredStatus === "DRAFT" && current.status === "READY") {
    return failure(
      "READY_LOCKED",
      "Ready drafts must be reverted before editing",
    );
  }

  return failure("CONFLICT", "Social draft changed before the operation completed");
}

export async function getSocialDraftsByJourney(journeyId: string) {
  return prisma.socialDraft.findMany({
    where: { journeyId },
    select: socialDraftSelect,
    orderBy: { platform: "asc" },
  });
}

/**
 * Idempotent create contract: return an existing Journey/platform draft
 * without updating it, or create it with compound-unique race recovery.
 */
async function createSocialDraftCore(
  input: unknown,
  createdById: string,
): Promise<SocialDraftServiceResult<{
  draft: Awaited<ReturnType<typeof getSocialDraftsByJourney>>[number];
  created: boolean;
}>> {
  const parsed = createSocialDraftSchema.safeParse(input);
  if (!parsed.success || createdById.length === 0) {
    return failure("VALIDATION_ERROR", "Invalid social draft input");
  }

  try {
    const journeyResult = await getMutableJourney(parsed.data.journeyId);
    if (!journeyResult.success) return journeyResult;

    const compoundWhere = {
      journeyId_platform: {
        journeyId: parsed.data.journeyId,
        platform: parsed.data.platform,
      },
    };

    const existing = await prisma.socialDraft.findUnique({
      where: compoundWhere,
      select: socialDraftSelect,
    });

    if (existing) {
      return { success: true, data: { draft: existing, created: false } };
    }

    if (
      parsed.data.mediaId &&
      !(await isAssignableSocialMedia(
        parsed.data.journeyId,
        parsed.data.mediaId,
      ))
    ) {
      return failure(
        "INVALID_MEDIA",
        "Media is not a trusted image associated with this Journey",
      );
    }

    try {
      const draft = await prisma.socialDraft.create({
        data: {
          journeyId: parsed.data.journeyId,
          platform: parsed.data.platform,
          caption: parsed.data.caption,
          mediaId: parsed.data.mediaId ?? null,
          createdById,
        },
        select: socialDraftSelect,
      });

      return { success: true, data: { draft, created: true } };
    } catch (error) {
      if (!isSocialDraftUniqueConflict(error)) {
        throw error;
      }

      const winner = await prisma.socialDraft.findUnique({
        where: compoundWhere,
        select: socialDraftSelect,
      });

      return winner
        ? { success: true, data: { draft: winner, created: false } }
        : failure(
            "OPERATION_FAILED",
            "Failed to create social draft",
          );
    }
  } catch {
    return failure("OPERATION_FAILED", "Failed to create social draft");
  }
}

export async function createSocialDraft(
  input: unknown,
  createdById: string,
): Promise<SocialDraftServiceResult<Awaited<ReturnType<typeof getSocialDraftsByJourney>>[number]>> {
  const result = await createSocialDraftCore(input, createdById);
  return result.success
    ? { success: true, data: result.data.draft }
    : result;
}

export async function createSocialDraftWithOutcome(
  input: unknown,
  createdById: string,
) {
  return createSocialDraftCore(input, createdById);
}

export async function updateSocialDraft(
  input: unknown,
): Promise<SocialDraftServiceResult<Awaited<ReturnType<typeof getSocialDraftsByJourney>>[number]>> {
  const parsed = updateSocialDraftSchema.safeParse(input);
  if (!parsed.success) {
    return failure("VALIDATION_ERROR", "Invalid social draft input");
  }

  try {
    const journeyResult = await getMutableJourney(parsed.data.journeyId);
    if (!journeyResult.success) return journeyResult;

    if (
      parsed.data.mediaId &&
      !(await isAssignableSocialMedia(
        parsed.data.journeyId,
        parsed.data.mediaId,
      ))
    ) {
      return failure(
        "INVALID_MEDIA",
        "Media is not a trusted image associated with this Journey",
      );
    }

    const data: { caption?: string; mediaId?: string | null } = {};
    if (parsed.data.caption !== undefined) {
      data.caption = parsed.data.caption;
    }
    if (parsed.data.mediaId !== undefined) {
      data.mediaId = parsed.data.mediaId;
    }

    const updated = await prisma.socialDraft.updateMany({
      where: {
        id: parsed.data.draftId,
        journeyId: parsed.data.journeyId,
        updatedAt: parsed.data.updatedAt,
        status: "DRAFT",
      },
      data,
    });

    if (updated.count === 0) {
      return classifyConditionalMutationFailure(
        parsed.data.journeyId,
        parsed.data.draftId,
        parsed.data.updatedAt,
        "DRAFT",
      );
    }

    const draft = await prisma.socialDraft.findFirst({
      where: {
        id: parsed.data.draftId,
        journeyId: parsed.data.journeyId,
      },
      select: socialDraftSelect,
    });

    return draft
      ? { success: true, data: draft }
      : failure("NOT_FOUND", "Social draft not found");
  } catch {
    return failure("OPERATION_FAILED", "Failed to update social draft");
  }
}

export async function transitionSocialDraftStatus(
  input: unknown,
): Promise<SocialDraftServiceResult<Awaited<ReturnType<typeof getSocialDraftsByJourney>>[number]>> {
  const parsed = transitionSocialDraftStatusSchema.safeParse(input);
  if (!parsed.success) {
    return failure("VALIDATION_ERROR", "Invalid social draft transition");
  }

  try {
    const journeyResult = await getMutableJourney(parsed.data.journeyId);
    if (!journeyResult.success) return journeyResult;

    const current = await prisma.socialDraft.findFirst({
      where: {
        id: parsed.data.draftId,
        journeyId: parsed.data.journeyId,
      },
      select: socialDraftSelect,
    });

    if (!current) {
      return failure("NOT_FOUND", "Social draft not found");
    }
    if (current.updatedAt.getTime() !== parsed.data.updatedAt.getTime()) {
      return failure("CONFLICT", "Social draft changed since it was loaded");
    }

    const validTransition =
      (current.status === "DRAFT" && parsed.data.targetStatus === "READY") ||
      (current.status === "READY" && parsed.data.targetStatus === "DRAFT");

    if (!validTransition) {
      return failure("INVALID_TRANSITION", "Invalid social draft transition");
    }

    if (parsed.data.targetStatus === "READY") {
      if (
        journeyResult.data.status !== "APPROVED" &&
        journeyResult.data.status !== "PUBLISHED"
      ) {
        return failure(
          "EDITORIAL_INCOMPLETE",
          "Journey must be approved before its social draft can be ready",
        );
      }

      if (!readySocialDraftCaptionSchema.safeParse(current.caption).success) {
        return failure(
          "EDITORIAL_INCOMPLETE",
          "Caption is required before marking a draft ready",
        );
      }

      if (current.platform === "INSTAGRAM" && !current.mediaId) {
        return failure(
          "EDITORIAL_INCOMPLETE",
          "Instagram drafts require a selected image",
        );
      }

      if (
        current.mediaId &&
        !(await isAssignableSocialMedia(
          parsed.data.journeyId,
          current.mediaId,
        ))
      ) {
        return failure(
          "INVALID_MEDIA",
          "Selected Media is no longer a trusted Journey image",
        );
      }
    }

    const updated = await prisma.socialDraft.updateMany({
      where: {
        id: parsed.data.draftId,
        journeyId: parsed.data.journeyId,
        updatedAt: parsed.data.updatedAt,
        status: current.status,
      },
      data: { status: parsed.data.targetStatus },
    });

    if (updated.count === 0) {
      return classifyConditionalMutationFailure(
        parsed.data.journeyId,
        parsed.data.draftId,
        parsed.data.updatedAt,
      );
    }

    const draft = await prisma.socialDraft.findFirst({
      where: {
        id: parsed.data.draftId,
        journeyId: parsed.data.journeyId,
      },
      select: socialDraftSelect,
    });

    return draft
      ? { success: true, data: draft }
      : failure("NOT_FOUND", "Social draft not found");
  } catch {
    return failure("OPERATION_FAILED", "Failed to change social draft status");
  }
}

export async function deleteSocialDraft(
  input: unknown,
): Promise<SocialDraftServiceResult<null>> {
  const parsed = deleteSocialDraftSchema.safeParse(input);
  if (!parsed.success) {
    return failure("VALIDATION_ERROR", "Invalid social draft input");
  }

  try {
    const journeyResult = await getMutableJourney(parsed.data.journeyId);
    if (!journeyResult.success) return journeyResult;

    const deleted = await prisma.socialDraft.deleteMany({
      where: {
        id: parsed.data.draftId,
        journeyId: parsed.data.journeyId,
      },
    });

    return deleted.count === 0
      ? failure("NOT_FOUND", "Social draft not found")
      : { success: true, data: null };
  } catch {
    return failure("OPERATION_FAILED", "Failed to delete social draft");
  }
}

export async function getSocialDraftEligibility(
  journeyId: string,
  draftId: string,
  siteOriginResolved: boolean,
): Promise<
  SocialDraftServiceResult<{
    draftId: string;
    journeyId: string;
    editorialStatus: "DRAFT" | "READY";
    eligibility: SocialDraftEligibilityResult;
  }>
> {
  try {
    const [journey, draft] = await Promise.all([
      prisma.journey.findUnique({
        where: { id: journeyId },
        select: {
          id: true,
          status: true,
          visibility: true,
          publicationConsent: { select: { consentGiven: true } },
        },
      }),
      prisma.socialDraft.findFirst({
        where: { id: draftId, journeyId },
        select: {
          id: true,
          journeyId: true,
          platform: true,
          caption: true,
          mediaId: true,
          status: true,
        },
      }),
    ]);

    if (!journey || !draft) {
      return failure("NOT_FOUND", "Social draft not found");
    }

    const hasPersistedMedia = draft.mediaId !== null;
    const hasTrustedPersistedMedia = draft.mediaId
      ? await isAssignableSocialMedia(journeyId, draft.mediaId)
      : false;

    return {
      success: true,
      data: {
        draftId: draft.id,
        journeyId: draft.journeyId,
        editorialStatus: draft.status,
        eligibility: getSocialDraftPublishEligibility({
          editorialStatus: draft.status,
          journeyStatus: journey.status,
          journeyVisibility: journey.visibility,
          publicationConsentGiven:
            journey.publicationConsent?.consentGiven ?? false,
          platform: draft.platform,
          caption: draft.caption,
          hasPersistedMedia,
          hasTrustedPersistedMedia,
          siteOriginResolved,
        }),
      },
    };
  } catch {
    return failure("OPERATION_FAILED", "Failed to evaluate social draft");
  }
}
