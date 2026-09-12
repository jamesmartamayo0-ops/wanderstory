import type {
  JourneyStatus,
  JourneyVisibility,
  SocialDraftStatus,
  SocialPlatform,
} from "../app/generated/prisma/enums";
import type { SocialDraftEligibilityResult } from "../lib/social-draft-eligibility";

export type SerializedSocialDraft = {
  id: string;
  journeyId: string;
  platform: SocialPlatform;
  caption: string;
  mediaId: string | null;
  status: SocialDraftStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialDraftActionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "ALREADY_ARCHIVED"
  | "INVALID_MEDIA"
  | "INVALID_TRANSITION"
  | "EDITORIAL_INCOMPLETE"
  | "READY_LOCKED"
  | "CONFLICT"
  | "OPERATION_FAILED";

export type SocialDraftActionResult<T = SerializedSocialDraft> =
  | { success: true; data: T }
  | {
      success: false;
      code: SocialDraftActionErrorCode;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

export type SocialStudioMediaItem = {
  id: string;
  fileName: string;
  url: string;
  thumbnailUrl: null;
  type: "IMAGE";
  mimeType: string;
  altText: string | null;
  order: number;
};

export type SocialStudioPreview = {
  mediaId: string | null;
  url: string;
  altText: string;
  source: "SELECTED" | "OG_IMAGE" | "COVER" | "JOURNEY_MEDIA" | "PLACEHOLDER";
};

export type SocialStudioData = {
  journey: {
    id: string;
    title: string;
    slug: string;
    status: JourneyStatus;
    visibility: JourneyVisibility;
    publicationConsentGiven: boolean;
  };
  drafts: Array<{
    draft: SerializedSocialDraft;
    eligibility: SocialDraftEligibilityResult;
    preview: SocialStudioPreview;
  }>;
  media: SocialStudioMediaItem[];
  defaultPreview: SocialStudioPreview;
  siteOriginResolved: boolean;
  publicJourneyUrl: string | null;
};

export type SocialStudioResult =
  | { success: true; data: SocialStudioData }
  | {
      success: false;
      code:
        | "NOT_FOUND"
        | "JOURNEY_LOAD_FAILED"
        | "DRAFT_LOAD_FAILED"
        | "MEDIA_LOAD_FAILED"
        | "ORIGIN_RESOLUTION_FAILED";
      error: string;
    };
