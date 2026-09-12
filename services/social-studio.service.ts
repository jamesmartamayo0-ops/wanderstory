import prisma from "../lib/prisma";
import { isTrustedJourneyImageMedia } from "../lib/journey-media-trust";
import { getSocialDraftPublishEligibility } from "../lib/social-draft-eligibility";
import {
  buildPublicJourneyUrl,
  resolveSiteOrigin,
  SiteOriginConfigurationError,
} from "../lib/site-url";
import {
  getSocialDraftsByJourney,
  isSocialMediaAssociatedWithJourney,
} from "./social-draft.service";
import type { Prisma } from "../app/generated/prisma/client";
import type {
  SerializedSocialDraft,
  SocialStudioMediaItem,
  SocialStudioPreview,
  SocialStudioResult,
} from "../types/social-draft";

const journeySelect = {
  id: true,
  title: true,
  slug: true,
  status: true,
  visibility: true,
  publicationConsent: { select: { consentGiven: true } },
  coverMediaId: true,
  ogImageId: true,
} as const satisfies Prisma.JourneySelect;

const mediaSelect = {
  id: true,
  fileName: true,
  url: true,
  type: true,
  mimeType: true,
  provider: true,
  altText: true,
  order: true,
  journeyId: true,
  chapter: { select: { journeyId: true } },
  journeyCover: { select: { id: true } },
  journeyOgImage: { select: { id: true } },
} as const satisfies Prisma.MediaSelect;

type StudioMedia = Prisma.MediaGetPayload<{ select: typeof mediaSelect }>;

function trustedForJourney(journeyId: string, media: StudioMedia): boolean {
  return isSocialMediaAssociatedWithJourney(journeyId, media) &&
    isTrustedJourneyImageMedia(media);
}

function mediaPreview(
  media: StudioMedia,
  source: SocialStudioPreview["source"],
  title: string,
): SocialStudioPreview {
  return {
    mediaId: media.id,
    url: media.url,
    altText: media.altText?.trim() || title,
    source,
  };
}

function serializeDraft(
  draft: Awaited<ReturnType<typeof getSocialDraftsByJourney>>[number],
): SerializedSocialDraft {
  return {
    id: draft.id,
    journeyId: draft.journeyId,
    platform: draft.platform,
    caption: draft.caption,
    mediaId: draft.mediaId,
    status: draft.status,
    createdById: draft.createdById,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
}

/** Server-side composition for an authenticated admin page; never creates drafts. */
export async function getSocialStudioData(journeyId: string): Promise<SocialStudioResult> {
  let journey;
  try {
    journey = await prisma.journey.findUnique({
      where: { id: journeyId },
      select: journeySelect,
    });
  } catch {
    return { success: false, code: "JOURNEY_LOAD_FAILED", error: "Failed to load Journey" };
  }
  if (!journey) {
    return { success: false, code: "NOT_FOUND", error: "Journey not found" };
  }

  let drafts;
  try {
    drafts = await getSocialDraftsByJourney(journeyId);
  } catch {
    return { success: false, code: "DRAFT_LOAD_FAILED", error: "Failed to load social drafts" };
  }

  const selectedIds = [...new Set(drafts.flatMap((draft) =>
    draft.mediaId === null ? [] : [draft.mediaId],
  ))];
  let candidates: StudioMedia[];
  let selectedMedia: StudioMedia[];
  try {
    [candidates, selectedMedia] = await Promise.all([
      prisma.media.findMany({
        where: {
          OR: [
            { journeyId },
            { chapter: { journeyId } },
            { journeyCover: { id: journeyId } },
            { journeyOgImage: { id: journeyId } },
          ],
        },
        select: mediaSelect,
        orderBy: [{ order: "asc" }, { id: "asc" }],
      }),
      // Read persisted IDs independently of picker qualification, including stale links.
      selectedIds.length
        ? prisma.media.findMany({
            where: { id: { in: selectedIds } },
            select: mediaSelect,
          })
        : Promise.resolve([]),
    ]);
  } catch {
    return { success: false, code: "MEDIA_LOAD_FAILED", error: "Failed to load Journey media" };
  }

  let origin: URL | null = null;
  try {
    origin = resolveSiteOrigin();
  } catch (error) {
    if (!(error instanceof SiteOriginConfigurationError)) {
      return {
        success: false,
        code: "ORIGIN_RESOLUTION_FAILED",
        error: "Failed to resolve the site origin",
      };
    }
  }

  const trustedSelected = new Map(
    selectedMedia.filter((media) => trustedForJourney(journeyId, media))
      .map((media) => [media.id, media]),
  );
  const persistedIds = new Set(selectedIds);
  const trustedCandidates = [...new Map(
    candidates.filter((media) =>
      trustedForJourney(journeyId, media) &&
      // A failed persisted-ID check must not be bypassed by a picker fallback.
      (!persistedIds.has(media.id) || trustedSelected.has(media.id)),
    )
      .map((media) => [media.id, media]),
  ).values()].sort((left, right) =>
    left.order - right.order || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
  const byId = new Map(trustedCandidates.map((media) => [media.id, media]));
  const og = journey.ogImageId ? byId.get(journey.ogImageId) : undefined;
  const cover = journey.coverMediaId ? byId.get(journey.coverMediaId) : undefined;
  const directOrChapter = trustedCandidates.find((media) =>
    media.journeyId === journeyId || media.chapter?.journeyId === journeyId,
  );
  const defaultPreview: SocialStudioPreview = og
    ? mediaPreview(og, "OG_IMAGE", journey.title)
    : cover
      ? mediaPreview(cover, "COVER", journey.title)
      : directOrChapter
        ? mediaPreview(directOrChapter, "JOURNEY_MEDIA", journey.title)
        : {
            mediaId: null,
            url: "/hero/placeholder-hero.jpg",
            altText: "WanderStory",
            source: "PLACEHOLDER",
          };
  const media: SocialStudioMediaItem[] = trustedCandidates.map((item) => ({
    id: item.id,
    fileName: item.fileName,
    url: item.url,
    thumbnailUrl: null,
    type: "IMAGE",
    mimeType: item.mimeType,
    altText: item.altText,
    order: item.order,
  }));
  const publicationConsentGiven = journey.publicationConsent?.consentGiven ?? false;

  return {
    success: true,
    data: {
      journey: {
        id: journey.id,
        title: journey.title,
        slug: journey.slug,
        status: journey.status,
        visibility: journey.visibility,
        publicationConsentGiven,
      },
      drafts: drafts.map((draft) => {
        const selected = draft.mediaId === null ? undefined : trustedSelected.get(draft.mediaId);
        return {
          draft: serializeDraft(draft),
          eligibility: getSocialDraftPublishEligibility({
            editorialStatus: draft.status,
            journeyStatus: journey.status,
            journeyVisibility: journey.visibility,
            publicationConsentGiven,
            platform: draft.platform,
            caption: draft.caption,
            hasPersistedMedia: draft.mediaId !== null,
            hasTrustedPersistedMedia: selected !== undefined,
            siteOriginResolved: origin !== null,
          }),
          preview: selected ? mediaPreview(selected, "SELECTED", journey.title) : defaultPreview,
        };
      }),
      media,
      defaultPreview,
      siteOriginResolved: origin !== null,
      publicJourneyUrl: origin && journey.status === "PUBLISHED" &&
        journey.visibility === "PUBLIC" && publicationConsentGiven
        ? buildPublicJourneyUrl(journey.slug, origin).toString()
        : null,
    },
  };
}
