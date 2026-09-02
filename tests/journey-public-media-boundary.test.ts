import assert from "node:assert/strict";
import test from "node:test";
import { toPublicJourneyDetail } from "../lib/adapters/journey-detail.adapter";
import { toPublicJourney } from "../lib/adapters/journey.adapter";

type JourneyImage = {
  url: string;
  provider: string;
  altText: string | null;
  blurDataUrl: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
  type: "IMAGE" | "VIDEO" | "DOCUMENT";
};

function trustedImage(
  overrides: Partial<JourneyImage> = {},
): JourneyImage {
  return {
    url: "https://res.cloudinary.com/wanderstory/image/upload/cover.jpg",
    provider: "CLOUDINARY",
    altText: "Trusted journey cover",
    blurDataUrl: null,
    width: 1600,
    height: 900,
    mimeType: "image/jpeg",
    type: "IMAGE",
    ...overrides,
  };
}

function detailRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "journey-1",
    title: "Island Story",
    travelerName: "A Traveler",
    introduction: "A public journey.",
    location: "Cebu",
    travelStartDate: "2026-08-01T00:00:00.000Z",
    travelEndDate: "2026-08-02T00:00:00.000Z",
    publishedAt: "2026-08-03T00:00:00.000Z",
    destination: {
      name: "Philippines",
      country: "Philippines",
      slug: "philippines",
    },
    coverMedia: trustedImage(),
    ogImage: null,
    categories: [],
    chapters: [],
    timelineEvents: [],
    quotes: [],
    media: [],
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    structuredData: null,
    ...overrides,
  };
}

function listRecord(coverMedia: JourneyImage | null) {
  return {
    id: "journey-1",
    slug: "island-story",
    title: "Island Story",
    travelerName: "A Traveler",
    introduction: "A public journey.",
    location: "Cebu",
    destination: { name: "Philippines", country: "Philippines" },
    coverMedia,
    _count: { chapters: 2 },
    publishedAt: "2026-08-03T00:00:00.000Z",
  };
}

test("trusted Cloudinary JPEG cover survives detail adaptation", () => {
  const cover = trustedImage();
  const result = toPublicJourneyDetail(detailRecord({ coverMedia: cover }));

  assert.deepEqual(result.coverMedia, cover);
});

for (const [format, mimeType] of [
  ["png", "image/png"],
  ["webp", "image/webp"],
] as const) {
  test(`trusted Cloudinary ${format.toUpperCase()} cover survives detail adaptation`, () => {
    const cover = trustedImage({
      url: `https://res.cloudinary.com/wanderstory/image/upload/cover.${format}`,
      mimeType,
    });

    assert.deepEqual(
      toPublicJourneyDetail(detailRecord({ coverMedia: cover })).coverMedia,
      cover,
    );
  });
}

const unsafeCovers: Array<[string, JourneyImage]> = [
  [
    "external HTTPS cover becomes null",
    trustedImage({ url: "https://images.example/cover.jpg" }),
  ],
  [
    "provider mismatch cover becomes null",
    trustedImage({ provider: "EXTERNAL" }),
  ],
  [
    "VIDEO cover becomes null",
    trustedImage({ type: "VIDEO", mimeType: "video/mp4" }),
  ],
  [
    "DOCUMENT cover becomes null",
    trustedImage({ type: "DOCUMENT", mimeType: "application/pdf" }),
  ],
  [
    "invalid MIME cover becomes null",
    trustedImage({ mimeType: "image/svg+xml" }),
  ],
  [
    "HTTP cover becomes null",
    trustedImage({
      url: "http://res.cloudinary.com/wanderstory/image/upload/cover.jpg",
    }),
  ],
  ["malformed cover URL becomes null", trustedImage({ url: "not a URL" })],
  [
    "credential-bearing cover URL becomes null",
    trustedImage({
      url: "https://user:password@res.cloudinary.com/wanderstory/image/upload/cover.jpg",
    }),
  ],
];

for (const [name, coverMedia] of unsafeCovers) {
  test(name, () => {
    const result = toPublicJourneyDetail(detailRecord({ coverMedia }));

    assert.equal(result.coverMedia, null);
  });
}

test("trusted ogImage survives detail adaptation", () => {
  const ogImage = trustedImage({
    url: "https://res.cloudinary.com/wanderstory/image/upload/social.png",
    mimeType: "image/png",
    altText: "Trusted social image",
  });

  assert.deepEqual(toPublicJourneyDetail(detailRecord({ ogImage })).ogImage, {
    url: ogImage.url,
    provider: ogImage.provider,
    altText: ogImage.altText,
    width: ogImage.width,
    height: ogImage.height,
    mimeType: ogImage.mimeType,
    type: ogImage.type,
  });
});

test("unsafe ogImage becomes null", () => {
  const ogImage = trustedImage({
    url: "https://images.example/social.jpg",
  });

  assert.equal(
    toPublicJourneyDetail(detailRecord({ ogImage })).ogImage,
    null,
  );
});

test("Gallery and Chapter Media are unchanged by cover and OG filtering", () => {
  const chapterMedia = {
    id: "chapter-media",
    url: "https://chapter-media.example/photo.jpg",
    thumbnailUrl: null,
    altText: "Chapter media",
    width: 800,
    height: 600,
    blurDataUrl: null,
    role: "CHAPTER",
  };
  const galleryMedia = {
    id: "gallery-media",
    url: "https://gallery-media.example/photo.jpg",
    thumbnailUrl: null,
    altText: "Gallery media",
    width: 800,
    height: 600,
    blurDataUrl: null,
    role: "GALLERY",
  };

  const result = toPublicJourneyDetail(detailRecord({
    coverMedia: trustedImage({ url: "https://unsafe.example/cover.jpg" }),
    ogImage: trustedImage({ url: "https://unsafe.example/social.jpg" }),
    chapters: [{
      id: "chapter-1",
      title: "Chapter",
      order: 0,
      content: "Chapter content",
      location: null,
      media: [chapterMedia],
    }],
    media: [galleryMedia],
  }));

  assert.equal(result.coverMedia, null);
  assert.equal(result.ogImage, null);
  assert.equal(result.chapters[0].media[0].url, chapterMedia.url);
  assert.equal(result.gallery[0].url, galleryMedia.url);
});

test("toPublicJourney keeps a trusted cover URL", () => {
  const cover = trustedImage({ altText: "List cover" });
  const result = toPublicJourney(listRecord(cover));

  assert.equal(result.coverUrl, cover.url);
  assert.equal(result.coverAlt, cover.altText);
});

test("toPublicJourney converts an unsafe cover to null for JourneyCard", () => {
  const result = toPublicJourney(listRecord(trustedImage({
    url: "https://images.example/list-cover.jpg",
  })));

  assert.equal(result.coverUrl, null);
  assert.equal(result.coverAlt, null);
});
