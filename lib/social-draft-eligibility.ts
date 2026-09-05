export type SocialDraftEligibilityReason =
  | "EDITORIAL_NOT_READY"
  | "JOURNEY_NOT_PUBLISHED"
  | "JOURNEY_NOT_PUBLIC"
  | "PUBLICATION_CONSENT_MISSING"
  | "CAPTION_REQUIRED"
  | "INSTAGRAM_MEDIA_REQUIRED"
  | "MEDIA_UNTRUSTED"
  | "SITE_ORIGIN_UNAVAILABLE";

export type SocialDraftEligibilityInput = {
  editorialStatus: "DRAFT" | "READY";
  journeyStatus: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED" | "ARCHIVED";
  journeyVisibility: "PUBLIC" | "PRIVATE";
  publicationConsentGiven: boolean;
  platform: "FACEBOOK" | "INSTAGRAM";
  caption: string;
  hasPersistedMedia: boolean;
  hasTrustedPersistedMedia: boolean;
  siteOriginResolved: boolean;
};

export type SocialDraftEligibilityResult = {
  eligible: boolean;
  reasons: SocialDraftEligibilityReason[];
};

export function getSocialDraftPublishEligibility(
  input: SocialDraftEligibilityInput,
): SocialDraftEligibilityResult {
  const reasons: SocialDraftEligibilityReason[] = [];

  if (input.editorialStatus !== "READY") {
    reasons.push("EDITORIAL_NOT_READY");
  }
  if (input.journeyStatus !== "PUBLISHED") {
    reasons.push("JOURNEY_NOT_PUBLISHED");
  }
  if (input.journeyVisibility !== "PUBLIC") {
    reasons.push("JOURNEY_NOT_PUBLIC");
  }
  if (!input.publicationConsentGiven) {
    reasons.push("PUBLICATION_CONSENT_MISSING");
  }
  if (input.caption.trim().length === 0) {
    reasons.push("CAPTION_REQUIRED");
  }
  if (input.platform === "INSTAGRAM" && !input.hasPersistedMedia) {
    reasons.push("INSTAGRAM_MEDIA_REQUIRED");
  }
  if (input.hasPersistedMedia && !input.hasTrustedPersistedMedia) {
    reasons.push("MEDIA_UNTRUSTED");
  }
  if (!input.siteOriginResolved) {
    reasons.push("SITE_ORIGIN_UNAVAILABLE");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
