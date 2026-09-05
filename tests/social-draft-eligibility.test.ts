import assert from "node:assert/strict";
import test from "node:test";
import {
  getSocialDraftPublishEligibility,
  type SocialDraftEligibilityInput,
} from "../lib/social-draft-eligibility";

function eligibleInput(
  overrides: Partial<SocialDraftEligibilityInput> = {},
): SocialDraftEligibilityInput {
  return {
    editorialStatus: "READY",
    journeyStatus: "PUBLISHED",
    journeyVisibility: "PUBLIC",
    publicationConsentGiven: true,
    platform: "FACEBOOK",
    caption: "A complete caption",
    hasPersistedMedia: false,
    hasTrustedPersistedMedia: false,
    siteOriginResolved: true,
    ...overrides,
  };
}

test("PUBLISHED PUBLIC consented Facebook draft can be eligible without Media", () => {
  assert.deepEqual(getSocialDraftPublishEligibility(eligibleInput()), {
    eligible: true,
    reasons: [],
  });
});

test("READY alone does not establish publish eligibility", () => {
  const result = getSocialDraftPublishEligibility(
    eligibleInput({
      journeyStatus: "APPROVED",
      journeyVisibility: "PRIVATE",
      publicationConsentGiven: false,
      siteOriginResolved: false,
    }),
  );

  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, [
    "JOURNEY_NOT_PUBLISHED",
    "JOURNEY_NOT_PUBLIC",
    "PUBLICATION_CONSENT_MISSING",
    "SITE_ORIGIN_UNAVAILABLE",
  ]);
});

test("editorial DRAFT is ineligible", () => {
  assert.deepEqual(
    getSocialDraftPublishEligibility(
      eligibleInput({ editorialStatus: "DRAFT" }),
    ).reasons,
    ["EDITORIAL_NOT_READY"],
  );
});

test("empty caption is ineligible", () => {
  assert.deepEqual(
    getSocialDraftPublishEligibility(eligibleInput({ caption: " \n " })).reasons,
    ["CAPTION_REQUIRED"],
  );
});

test("Instagram requires explicitly persisted trusted Media", () => {
  const missing = getSocialDraftPublishEligibility(
    eligibleInput({ platform: "INSTAGRAM" }),
  );
  const untrusted = getSocialDraftPublishEligibility(
    eligibleInput({
      platform: "INSTAGRAM",
      hasPersistedMedia: true,
      hasTrustedPersistedMedia: false,
    }),
  );
  const trusted = getSocialDraftPublishEligibility(
    eligibleInput({
      platform: "INSTAGRAM",
      hasPersistedMedia: true,
      hasTrustedPersistedMedia: true,
    }),
  );

  assert.deepEqual(missing.reasons, ["INSTAGRAM_MEDIA_REQUIRED"]);
  assert.deepEqual(untrusted.reasons, ["MEDIA_UNTRUSTED"]);
  assert.equal(trusted.eligible, true);
});

test("removed Instagram Media makes eligibility false without changing editorial status", () => {
  const result = getSocialDraftPublishEligibility(
    eligibleInput({
      editorialStatus: "READY",
      platform: "INSTAGRAM",
      hasPersistedMedia: false,
      hasTrustedPersistedMedia: false,
    }),
  );

  assert.equal(result.eligible, false);
  assert.deepEqual(result.reasons, ["INSTAGRAM_MEDIA_REQUIRED"]);
});

test("an existing untrusted Facebook Media selection is ineligible", () => {
  assert.deepEqual(
    getSocialDraftPublishEligibility(
      eligibleInput({
        hasPersistedMedia: true,
        hasTrustedPersistedMedia: false,
      }),
    ).reasons,
    ["MEDIA_UNTRUSTED"],
  );
});
