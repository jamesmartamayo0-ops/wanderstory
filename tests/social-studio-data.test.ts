import assert from "node:assert/strict";
import test, { before, beforeEach, mock } from "node:test";
import * as siteUrl from "../lib/site-url";
import type { SerializedSocialDraft, SocialStudioData } from "../types/social-draft";

type Draft = Omit<SerializedSocialDraft, "createdAt" | "updatedAt"> & {
  createdAt: Date; updatedAt: Date;
};
type Journey = {
  id: string; title: string; slug: string;
  status: SocialStudioData["journey"]["status"];
  visibility: "PUBLIC" | "PRIVATE";
  publicationConsent: { consentGiven: boolean; notes?: string } | null;
  coverMediaId: string | null; ogImageId: string | null;
  privateToken?: string; canonicalUrl?: string; client?: { notes: string };
};
type Media = {
  id: string; fileName: string; url: string; thumbnailUrl: string;
  type: "IMAGE" | "VIDEO" | "DOCUMENT"; mimeType: string; provider: string;
  altText: string | null; order: number; journeyId: string | null;
  chapter: { journeyId: string } | null;
  journeyCover: { id: string } | null; journeyOgImage: { id: string } | null;
  destinationHero?: { id: string };
};
const journeyId = "journey-1";
function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: "draft-1", journeyId, platform: "FACEBOOK", caption: "A saved caption",
    mediaId: null, status: "READY", createdById: "actor-1",
    createdAt: new Date("2026-09-03T00:00:00.000Z"),
    updatedAt: new Date("2026-09-03T12:00:00.000Z"), ...overrides,
  };
}
function media(id: string, overrides: Partial<Media> = {}): Media {
  return {
    id, fileName: `${id}.jpg`, url: `https://res.cloudinary.com/test/image/upload/${id}.jpg`,
    thumbnailUrl: "https://unsafe.example/thumbnail.jpg", type: "IMAGE", mimeType: "image/jpeg",
    provider: "CLOUDINARY", altText: `Image ${id}`, order: 0, journeyId,
    chapter: null, journeyCover: null, journeyOgImage: null, ...overrides,
  };
}
let journey: Journey | null;
let drafts: Draft[];
let candidates: Media[];
let selectedRows: Media[];
let failure: "journey" | "drafts" | "candidates" | "selected" | null;
let originFailure: "configuration" | "unexpected" | null;
let queries: Array<{ model: string; args: Record<string, unknown> }>;
let builtUrls: Array<{ slug: string; origin: string }>;

const prisma = {
  journey: { findUnique: async (args: Record<string, unknown>) => {
    queries.push({ model: "journey", args });
    if (failure === "journey") throw new Error("private DB details");
    return journey;
  } },
  socialDraft: { findMany: async (args: Record<string, unknown>) => {
    queries.push({ model: "socialDraft", args });
    if (failure === "drafts") throw new Error("private DB details");
    return drafts;
  } },
  media: { findMany: async (args: { where: { id?: { in: string[] }; OR?: unknown[] }; select: Record<string, unknown> }) => {
    queries.push({ model: "media", args });
    const selected = args.where.id !== undefined;
    if (failure === (selected ? "selected" : "candidates")) throw new Error("private media DB details");
    return selected ? selectedRows : candidates;
  } },
};
type MockModule = (specifier: string, options: { exports: Record<string, unknown> }) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);
mockModule("../lib/prisma", { exports: { default: prisma, prisma } });
mockModule("../lib/site-url", {
  exports: {
    ...siteUrl,
    resolveSiteOrigin: () => {
      if (originFailure === "configuration") throw new siteUrl.SiteOriginConfigurationError("bad configuration");
      if (originFailure === "unexpected") throw new Error("internal origin details");
      return siteUrl.resolveSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://wanderstory.example", VERCEL: "1" });
    },
    buildPublicJourneyUrl: (slug: string, origin: URL) => {
      builtUrls.push({ slug, origin: origin.origin });
      return siteUrl.buildPublicJourneyUrl(slug, origin);
    },
  },
});
let service!: typeof import("../services/social-studio.service");
before(async () => { service = await import("../services/social-studio.service"); });
beforeEach(() => {
  journey = {
    id: journeyId, title: "Island Story", slug: "island-story", status: "PUBLISHED", visibility: "PUBLIC",
    publicationConsent: { consentGiven: true }, coverMediaId: null, ogImageId: null,
  };
  drafts = [draft()];
  candidates = [];
  selectedRows = [];
  failure = null;
  originFailure = null;
  queries = [];
  builtUrls = [];
});
async function load() {
  const result = await service.getSocialStudioData(journeyId);
  assert.ok(result.success, JSON.stringify(result));
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, "DTO must be JSON serializable without conversion losses");
  return result.data;
}

test("Journey selection is narrow and draft loading uses the existing scoped select", async () => {
  await load();
  assert.deepEqual(queries.find(q => q.model === "journey")?.args, {
    where: { id: journeyId },
    select: {
      id: true, title: true, slug: true, status: true, visibility: true,
      publicationConsent: { select: { consentGiven: true } }, coverMediaId: true, ogImageId: true,
    },
  });
  assert.deepEqual(queries.find(q => q.model === "socialDraft")?.args, {
    where: { journeyId }, orderBy: { platform: "asc" },
    select: { id: true, journeyId: true, platform: true, caption: true, mediaId: true,
      status: true, createdById: true, createdAt: true, updatedAt: true },
  });
});

for (const field of ["privateToken", "canonicalUrl", "client", "notes", "author"] as const) {
  test(`Journey query and DTO exclude ${field}`, async () => {
    assert.ok(journey);
    journey.privateToken = "secret-preview-token";
    journey.canonicalUrl = "https://private.example/editorial";
    journey.client = { notes: "secret-client-notes" };
    journey.publicationConsent = { consentGiven: true, notes: "secret-consent-notes" };
    const data = await load();
    assert.equal(JSON.stringify(queries).includes(`"${field}"`), false);
    assert.equal(JSON.stringify(data).includes(`"${field}"`), false);
    assert.equal(JSON.stringify(data).includes("secret-"), false);
  });
}

test("candidate query is limited to exactly four ownership routes and stable order", async () => {
  await load();
  const query = queries.find(q => q.model === "media")?.args;
  assert.ok(query);
  assert.deepEqual(query.where, { OR: [
    { journeyId }, { chapter: { journeyId } },
    { journeyCover: { id: journeyId } }, { journeyOgImage: { id: journeyId } },
  ] });
  assert.deepEqual(query.orderBy, [{ order: "asc" }, { id: "asc" }]);
  assert.deepEqual(query.select, {
    id: true, fileName: true, url: true, type: true, mimeType: true, provider: true,
    altText: true, order: true, journeyId: true,
    chapter: { select: { journeyId: true } }, journeyCover: { select: { id: true } },
    journeyOgImage: { select: { id: true } },
  });
});

for (const [name, ownership] of [
  ["direct", { journeyId }],
  ["chapter", { journeyId: null, chapter: { journeyId } }],
  ["cover", { journeyId: null, journeyCover: { id: journeyId } }],
  ["OG", { journeyId: null, journeyOgImage: { id: journeyId } }],
] as const) {
  test(`${name} associated trusted image is selectable with a null thumbnail`, async () => {
    candidates = [media("image-1", ownership)];
    const data = await load();
    assert.deepEqual(data.media, [{
      id: "image-1", fileName: "image-1.jpg", url: candidates[0].url,
      thumbnailUrl: null, type: "IMAGE", mimeType: "image/jpeg", altText: "Image image-1", order: 0,
    }]);
    assert.equal(JSON.stringify(data).includes("unsafe.example/thumbnail"), false);
  });
}

const invalidMedia: Array<[string, Partial<Media>]> = [
  ["foreign direct", { journeyId: "journey-2" }],
  ["foreign chapter", { journeyId: null, chapter: { journeyId: "journey-2" } }],
  ["foreign cover", { journeyId: null, journeyCover: { id: "journey-2" } }],
  ["foreign OG", { journeyId: null, journeyOgImage: { id: "journey-2" } }],
  ["unattached", { journeyId: null }],
  ["destination-only", { journeyId: null, destinationHero: { id: "destination-1" } }],
  ["VIDEO", { type: "VIDEO", mimeType: "image/jpeg" }],
  ["DOCUMENT", { type: "DOCUMENT", mimeType: "image/jpeg" }],
  ["external HTTPS", { url: "https://unsafe.example/image.jpg" }],
  ["HTTP", { url: "http://res.cloudinary.com/test/image.jpg" }],
  ["provider mismatch", { provider: "EXTERNAL" }],
  ["unsafe MIME", { mimeType: "image/svg+xml" }],
  ["credentials", { url: "https://user:password@res.cloudinary.com/test/image.jpg" }],
  ["javascript URL", { url: "javascript:alert(1)" }],
];
for (const [name, overrides] of invalidMedia) {
  test(`${name} is rejected as a candidate and as persisted selected media`, async () => {
    const image = media("unsafe", overrides);
    candidates = [image];
    selectedRows = [image];
    drafts = [draft({ platform: "INSTAGRAM", mediaId: image.id })];
    const data = await load();
    assert.deepEqual(data.media, []);
    assert.deepEqual(data.drafts[0].eligibility, { eligible: false, reasons: ["MEDIA_UNTRUSTED"] });
    assert.equal(data.drafts[0].draft.status, "READY");
    assert.equal(data.drafts[0].draft.mediaId, image.id);
    assert.equal(data.drafts[0].preview.source, "PLACEHOLDER");
    assert.notEqual(data.drafts[0].preview.url, image.url);
  });
}

test("Facebook READY with no persisted Media derives eligible from current Journey truth", async () => {
  const data = await load();
  assert.deepEqual(data.drafts[0].eligibility, { eligible: true, reasons: [] });
});

test("Instagram persisted trusted media is verified independently of absent picker candidates", async () => {
  drafts = [draft({ platform: "INSTAGRAM", mediaId: "selected" })];
  selectedRows = [media("selected")];
  const data = await load();
  assert.deepEqual(data.media, []);
  assert.deepEqual(data.drafts[0].eligibility, { eligible: true, reasons: [] });
  assert.equal(data.drafts[0].preview.source, "SELECTED");
  assert.equal(data.drafts[0].preview.url, selectedRows[0].url);
  assert.ok(queries.some(q => q.model === "media" && JSON.stringify(q.args.where) === JSON.stringify({ id: { in: ["selected"] } })));
});

test("a formerly trusted picker candidate cannot override a now-untrusted persisted selection", async () => {
  drafts = [draft({ platform: "INSTAGRAM", mediaId: "selected" })];
  candidates = [media("selected")];
  selectedRows = [media("selected", { journeyId: "journey-2" })];
  const data = await load();
  assert.deepEqual(data.drafts[0].eligibility.reasons, ["MEDIA_UNTRUSTED"]);
  assert.deepEqual(data.media, []);
  assert.equal(data.drafts[0].preview.source, "PLACEHOLDER");
  assert.equal(data.drafts[0].draft.status, "READY");
});

test("a missing persisted ID cannot be reintroduced by OG or cover fallback candidates", async () => {
  assert.ok(journey);
  journey.ogImageId = "missing";
  journey.coverMediaId = "missing";
  drafts = [draft({ mediaId: "missing" })];
  candidates = [media("missing", { journeyId: null, journeyOgImage: { id: journeyId }, journeyCover: { id: journeyId } })];
  const data = await load();
  assert.deepEqual(data.media, []);
  assert.equal(data.defaultPreview.source, "PLACEHOLDER");
  assert.equal(data.drafts[0].preview.source, "PLACEHOLDER");
  assert.deepEqual(data.drafts[0].eligibility.reasons, ["MEDIA_UNTRUSTED"]);
});

test("Instagram no Media remains incomplete even when a trusted preview fallback exists", async () => {
  drafts = [draft({ platform: "INSTAGRAM" })];
  candidates = [media("fallback")];
  const data = await load();
  assert.deepEqual(data.drafts[0].eligibility.reasons, ["INSTAGRAM_MEDIA_REQUIRED"]);
  assert.equal(data.drafts[0].draft.mediaId, null);
  assert.equal(data.drafts[0].preview.mediaId, "fallback");
});

test("missing persisted row is MEDIA_UNTRUSTED, distinct from a null mediaId", async () => {
  drafts = [draft({ platform: "INSTAGRAM", mediaId: "deleted" })];
  const data = await load();
  assert.deepEqual(data.drafts[0].eligibility.reasons, ["MEDIA_UNTRUSTED"]);
  assert.equal(data.drafts[0].draft.mediaId, "deleted");
});

function previewFixtures() {
  assert.ok(journey);
  journey.ogImageId = "og";
  journey.coverMediaId = "cover";
  candidates = [
    media("direct"), media("cover", { journeyId: null, journeyCover: { id: journeyId } }),
    media("og", { journeyId: null, journeyOgImage: { id: journeyId } }),
  ];
}
test("selected trusted Media takes precedence over OG, cover, and direct images", async () => {
  previewFixtures();
  drafts = [draft({ mediaId: "selected" })];
  selectedRows = [media("selected")];
  const data = await load();
  assert.equal(data.drafts[0].preview.mediaId, "selected");
  assert.equal(data.drafts[0].preview.source, "SELECTED");
  assert.equal(data.defaultPreview.source, "OG_IMAGE");
});
test("OG fallback takes precedence over cover and direct images", async () => {
  previewFixtures();
  const data = await load();
  assert.equal(data.drafts[0].preview.mediaId, "og");
  assert.equal(data.drafts[0].preview.source, "OG_IMAGE");
});
test("cover fallback is used when OG is unsafe", async () => {
  previewFixtures();
  candidates.find(m => m.id === "og")!.url = "https://unsafe.example/og.jpg";
  const data = await load();
  assert.equal(data.drafts[0].preview.mediaId, "cover");
  assert.equal(data.drafts[0].preview.source, "COVER");
  assert.equal(JSON.stringify(data).includes("unsafe.example"), false);
});
test("direct/chapter fallback is ordered by order and then ID, with duplicates removed", async () => {
  const images = [
    media("z", { order: 0 }), media("b", { order: 0 }), media("a", { order: 3 }),
    media("chapter", { order: -1, journeyId: null, chapter: { journeyId } }),
  ];
  candidates = [...images, images[1]];
  const first = await load();
  candidates = [...candidates].reverse();
  const second = await load();
  assert.deepEqual(first.media.map(m => m.id), ["chapter", "b", "z", "a"]);
  assert.deepEqual(second.media, first.media);
  assert.equal(first.defaultPreview.source, "JOURNEY_MEDIA");
  assert.equal(first.defaultPreview.mediaId, "chapter");
  assert.deepEqual(second.defaultPreview, first.defaultPreview);
});
test("placeholder is a fixed safe local image", async () => {
  const data = await load();
  assert.deepEqual(data.defaultPreview, {
    mediaId: null, url: "/hero/placeholder-hero.jpg", altText: "WanderStory", source: "PLACEHOLDER",
  });
});
test("unsafe selected, OG, and cover URLs fall through to a trusted chapter image", async () => {
  previewFixtures();
  for (const item of candidates) item.url = "https://unsafe.example/image.jpg";
  candidates.push(media("chapter", { journeyId: null, chapter: { journeyId } }));
  selectedRows = [media("selected", { url: "https://unsafe.example/selected.jpg" })];
  drafts = [draft({ mediaId: "selected" })];
  const data = await load();
  assert.equal(data.drafts[0].preview.mediaId, "chapter");
  assert.equal(JSON.stringify(data).includes("unsafe.example"), false);
});
test("read and preview fallback preserve all persisted draft fields", async () => {
  previewFixtures();
  const expected = structuredClone(drafts);
  await load();
  assert.deepEqual(drafts, expected);
});
test("empty draft loading returns no draft and still supplies the empty-card preview", async () => {
  drafts = [];
  previewFixtures();
  const data = await load();
  assert.deepEqual(data.drafts, []);
  assert.equal(data.defaultPreview.mediaId, "og");
  assert.equal(queries.filter(q => q.model === "socialDraft").length, 1);
});
test("persisted Media ID queries are deduplicated across platforms", async () => {
  drafts = [draft({ mediaId: "same" }), draft({ id: "draft-2", platform: "INSTAGRAM", mediaId: "same" })];
  selectedRows = [media("same")];
  await load();
  assert.deepEqual(queries.filter(q => q.model === "media").map(q => q.args.where)[1], { id: { in: ["same"] } });
});
test("safe public URL uses only the stored slug and resolved origin with URL encoding", async () => {
  assert.ok(journey);
  journey.slug = "Cebu / 東京?story";
  journey.canonicalUrl = "https://unsafe.example/canonical";
  journey.privateToken = "secret-preview";
  const data = await load();
  assert.equal(data.publicJourneyUrl, "https://wanderstory.example/journeys/Cebu%20%2F%20%E6%9D%B1%E4%BA%AC%3Fstory");
  assert.deepEqual(builtUrls, [{ slug: journey.slug, origin: "https://wanderstory.example" }]);
});
test("origin configuration failure leaves editing data available and eligibility false", async () => {
  originFailure = "configuration";
  const data = await load();
  assert.equal(data.siteOriginResolved, false);
  assert.equal(data.publicJourneyUrl, null);
  assert.deepEqual(data.drafts[0].eligibility.reasons, ["SITE_ORIGIN_UNAVAILABLE"]);
  assert.equal(data.drafts[0].draft.caption, drafts[0].caption);
  assert.deepEqual(builtUrls, []);
});
for (const status of ["DRAFT", "REVIEW", "APPROVED", "ARCHIVED"] as const) {
  test(`${status} Journey has no public link`, async () => {
    assert.ok(journey);
    journey.status = status;
    const data = await load();
    assert.equal(data.publicJourneyUrl, null);
    assert.deepEqual(builtUrls, []);
  });
}
test("private Journey has no public link", async () => {
  assert.ok(journey);
  journey.visibility = "PRIVATE";
  assert.equal((await load()).publicJourneyUrl, null);
  assert.deepEqual(builtUrls, []);
});
test("unconsented Journey has no public link", async () => {
  assert.ok(journey);
  journey.publicationConsent = null;
  const data = await load();
  assert.equal(data.publicJourneyUrl, null);
  assert.deepEqual(data.drafts[0].eligibility.reasons, ["PUBLICATION_CONSENT_MISSING"]);
  assert.deepEqual(builtUrls, []);
});
test("draft dates serialize to ISO without extra fields", async () => {
  const data = await load();
  assert.deepEqual(data.drafts[0].draft, {
    ...draft(), createdAt: "2026-09-03T00:00:00.000Z", updatedAt: "2026-09-03T12:00:00.000Z",
  });
});
test("absent Journey is explicit NOT_FOUND and does not query drafts or Media", async () => {
  journey = null;
  assert.deepEqual(await service.getSocialStudioData(journeyId), {
    success: false, code: "NOT_FOUND", error: "Journey not found",
  });
  assert.equal(queries.length, 1);
});
for (const [stage, code] of [
  ["journey", "JOURNEY_LOAD_FAILED"], ["drafts", "DRAFT_LOAD_FAILED"],
  ["candidates", "MEDIA_LOAD_FAILED"], ["selected", "MEDIA_LOAD_FAILED"],
] as const) {
  test(`${stage} query failure is explicit and never an empty success`, async () => {
    failure = stage;
    drafts = [draft({ mediaId: "selected" })];
    selectedRows = [media("selected")];
    const result = await service.getSocialStudioData(journeyId);
    assert.ok(!result.success);
    assert.equal(result.code, code);
    assert.equal("data" in result, false);
    assert.equal(JSON.stringify(result).includes("private"), false);
  });
}
test("unexpected origin failure is distinct from configuration unavailability", async () => {
  originFailure = "unexpected";
  assert.deepEqual(await service.getSocialStudioData(journeyId), {
    success: false, code: "ORIGIN_RESOLUTION_FAILED", error: "Failed to resolve the site origin",
  });
});
