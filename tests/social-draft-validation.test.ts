import assert from "node:assert/strict";
import test from "node:test";
import {
  SOCIAL_DRAFT_CAPTION_MAX_LENGTH,
  createSocialDraftSchema,
  readySocialDraftCaptionSchema,
  socialDraftCaptionSchema,
  transitionSocialDraftStatusSchema,
  updateSocialDraftSchema,
} from "../lib/validation/social-draft.schema";

const baseCreate = {
  journeyId: "journey-1",
  caption: "Caption",
};

test("FACEBOOK and INSTAGRAM are accepted platforms", () => {
  for (const platform of ["FACEBOOK", "INSTAGRAM"]) {
    assert.equal(
      createSocialDraftSchema.safeParse({ ...baseCreate, platform }).success,
      true,
    );
  }
});

test("forged platforms are rejected", () => {
  assert.equal(
    createSocialDraftSchema.safeParse({ ...baseCreate, platform: "LINKEDIN" })
      .success,
    false,
  );
});

test("caption normalizes CRLF and CR to LF and trims outer whitespace", () => {
  const parsed = socialDraftCaptionSchema.parse(" \r\nFirst\rSecond\n\tThird\t \r\n");
  assert.equal(parsed, "First\nSecond\n\tThird");
});

test("caption permits normal line breaks and tabs", () => {
  assert.equal(
    socialDraftCaptionSchema.safeParse("First\nSecond\tvalue").success,
    true,
  );
});

test("caption accepts the 5000 JavaScript string-length boundary", () => {
  assert.equal(
    socialDraftCaptionSchema.safeParse(
      "a".repeat(SOCIAL_DRAFT_CAPTION_MAX_LENGTH),
    ).success,
    true,
  );
});

test("caption rejects values over 5000 JavaScript string units", () => {
  assert.equal(
    socialDraftCaptionSchema.safeParse(
      "a".repeat(SOCIAL_DRAFT_CAPTION_MAX_LENGTH + 1),
    ).success,
    false,
  );
});

test("empty DRAFT caption is allowed", () => {
  const parsed = createSocialDraftSchema.parse({
    journeyId: "journey-1",
    platform: "FACEBOOK",
    caption: "   ",
  });
  assert.equal(parsed.caption, "");
});

test("empty READY caption is rejected", () => {
  assert.equal(readySocialDraftCaptionSchema.safeParse(" \r\n ").success, false);
});

test("NUL and unsupported control characters are rejected", () => {
  for (const caption of ["unsafe\u0000text", "unsafe\u0007text", "unsafe\u007ftext"]) {
    assert.equal(socialDraftCaptionSchema.safeParse(caption).success, false);
  }
});

test("generic update cannot accept status, creator, URL, or arbitrary fields", () => {
  const base = {
    journeyId: "journey-1",
    draftId: "draft-1",
    caption: "Updated",
    updatedAt: new Date(),
  };

  for (const extra of [
    { status: "READY" },
    { createdById: "admin-2" },
    { publicUrl: "https://example.com/journey" },
    { payload: { publish: true } },
  ]) {
    assert.equal(updateSocialDraftSchema.safeParse({ ...base, ...extra }).success, false);
  }
});

test("status transition accepts only DRAFT and READY", () => {
  const base = {
    journeyId: "journey-1",
    draftId: "draft-1",
    updatedAt: new Date(),
  };
  assert.equal(
    transitionSocialDraftStatusSchema.safeParse({
      ...base,
      targetStatus: "READY",
    }).success,
    true,
  );
  assert.equal(
    transitionSocialDraftStatusSchema.safeParse({
      ...base,
      targetStatus: "PUBLISHED",
    }).success,
    false,
  );
});

test("update requires at least one editable field", () => {
  assert.equal(
    updateSocialDraftSchema.safeParse({
      journeyId: "journey-1",
      draftId: "draft-1",
      updatedAt: new Date(),
    }).success,
    false,
  );
});
