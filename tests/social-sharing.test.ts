import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicJourneyUrl,
  resolveSiteOrigin,
  SiteOriginConfigurationError,
  type SiteOriginEnvironment,
} from "../lib/site-url";
import {
  buildFacebookShareUrl,
  buildJourneyArticleJsonLd,
  buildJourneyMetadata,
  getJourneyDescription,
  getJourneyMetadataTitle,
  getJourneySocialTitle,
  normalizeJourneyDescription,
  resolveJourneyDocumentUrl,
  selectJourneySocialImage,
  type JourneySocialMedia,
  type JourneySocialMetadataInput,
} from "../lib/social-sharing";

function environment(
  overrides: Partial<SiteOriginEnvironment> = {},
): SiteOriginEnvironment {
  return {
    NEXT_PUBLIC_SITE_URL: undefined,
    VERCEL_PROJECT_PRODUCTION_URL: undefined,
    VERCEL: undefined,
    ...overrides,
  };
}

test("valid NEXT_PUBLIC_SITE_URL wins and normalizes its trailing slash", () => {
  const origin = resolveSiteOrigin(
    environment({
      NEXT_PUBLIC_SITE_URL: "https://www.wanderstory.example/",
      VERCEL_PROJECT_PRODUCTION_URL: "fallback.wanderstory.example",
    }),
  );

  assert.equal(origin.origin, "https://www.wanderstory.example");
  assert.equal(origin.pathname, "/");
});

test("valid VERCEL_PROJECT_PRODUCTION_URL is converted to HTTPS", () => {
  const origin = resolveSiteOrigin(
    environment({
      VERCEL: "1",
      VERCEL_PROJECT_PRODUCTION_URL: "wanderstory.example",
    }),
  );

  assert.equal(origin.origin, "https://wanderstory.example");
});

test("VERCEL_URL is never considered", () => {
  const deployedEnvironment = {
    ...environment({ VERCEL: "1" }),
    VERCEL_URL: "ephemeral-preview.vercel.app",
  };

  assert.throws(
    () => resolveSiteOrigin(deployedEnvironment),
    SiteOriginConfigurationError,
  );
});

test("localhost fallback is available only outside Vercel", () => {
  assert.equal(
    resolveSiteOrigin(environment()).origin,
    "http://localhost:3000",
  );
  assert.throws(
    () => resolveSiteOrigin(environment({ VERCEL: "1" })),
    SiteOriginConfigurationError,
  );
});

test("deployed Vercel fails closed when both configured origins are invalid", () => {
  assert.throws(
    () =>
      resolveSiteOrigin(
        environment({
          VERCEL: "1",
          NEXT_PUBLIC_SITE_URL: "http://wanderstory.example",
          VERCEL_PROJECT_PRODUCTION_URL: "https://not-a-hostname.example",
        }),
      ),
    (error: unknown) =>
      error instanceof SiteOriginConfigurationError &&
      error.name === "SiteOriginConfigurationError",
  );
});

test("deployed Vercel rejects explicitly configured loopback origins", () => {
  assert.throws(
    () =>
      resolveSiteOrigin(
        environment({
          VERCEL: "1",
          NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
          VERCEL_PROJECT_PRODUCTION_URL: "127.0.0.1",
        }),
      ),
    SiteOriginConfigurationError,
  );
});

test("configured origins reject malformed schemes and credentials", () => {
  for (const candidate of [
    "javascript:alert(1)",
    "data:text/plain,hello",
    "ftp://wanderstory.example",
    "https://user:password@wanderstory.example",
  ]) {
    assert.equal(
      resolveSiteOrigin(
        environment({ NEXT_PUBLIC_SITE_URL: candidate }),
      ).origin,
      "http://localhost:3000",
    );
  }
});

test("configured origins reject paths, queries, and fragments", () => {
  for (const candidate of [
    "https://wanderstory.example/path",
    "https://wanderstory.example/?",
    "https://wanderstory.example/?campaign=share",
    "https://wanderstory.example/#",
    "https://wanderstory.example/#fragment",
  ]) {
    assert.equal(
      resolveSiteOrigin(
        environment({ NEXT_PUBLIC_SITE_URL: candidate }),
      ).origin,
      "http://localhost:3000",
    );
  }
});

test("configured origins require HTTPS except for loopback development", () => {
  assert.equal(
    resolveSiteOrigin(
      environment({ NEXT_PUBLIC_SITE_URL: "http://wanderstory.example" }),
    ).origin,
    "http://localhost:3000",
  );
  assert.equal(
    resolveSiteOrigin(
      environment({ NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:4000" }),
    ).origin,
    "http://127.0.0.1:4000",
  );
});

test("Journey slugs are safely encoded with the URL API", () => {
  const url = buildPublicJourneyUrl(
    "Cebu / 東京?view=private#token",
    new URL("https://wanderstory.example"),
  );

  assert.equal(
    url.toString(),
    "https://wanderstory.example/journeys/Cebu%20%2F%20%E6%9D%B1%E4%BA%AC%3Fview%3Dprivate%23token",
  );
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
});

const siteOrigin = new URL("https://wanderstory.example");
const computedPublicJourneyUrl =
  "https://wanderstory.example/journeys/island-story";

const dedicatedImage: JourneySocialMedia = {
  provider: "CLOUDINARY",
  url: "https://res.cloudinary.com/wanderstory/image/upload/og-image.jpg",
  altText: "Sunset over the islands",
  width: 1600,
  height: 900,
  mimeType: "image/jpeg",
  type: "IMAGE",
};

const coverImage: JourneySocialMedia = {
  provider: "CLOUDINARY",
  url: "https://res.cloudinary.com/wanderstory/image/upload/cover.webp",
  altText: "Journey cover",
  width: 1920,
  height: 1080,
  mimeType: "image/webp",
  type: "IMAGE",
};

function journey(
  overrides: Partial<JourneySocialMetadataInput> = {},
): JourneySocialMetadataInput {
  return {
    title: "An Island Story",
    introduction: "A thoughtful journey across the islands.",
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    ogImage: dedicatedImage,
    coverMedia: coverImage,
    ...overrides,
  };
}

test("HTML title uses a non-empty SEO override", () => {
  assert.equal(
    getJourneyMetadataTitle(journey({ seoTitle: "  Island Reflections  " })),
    "Island Reflections",
  );
});

test("HTML title defaults to explicit WanderStory branding", () => {
  assert.equal(
    getJourneyMetadataTitle(journey({ seoTitle: "   " })),
    "An Island Story | WanderStory",
  );
});

test("social title uses an override or the plain Journey title", () => {
  assert.equal(
    getJourneySocialTitle(journey({ seoTitle: "  Island Reflections  " })),
    "Island Reflections",
  );
  assert.equal(
    getJourneySocialTitle(journey({ seoTitle: "   " })),
    "An Island Story",
  );
});

test("description collapses whitespace and prefers a non-empty SEO description", () => {
  assert.equal(
    getJourneyDescription(
      journey({ seoDescription: "  Across\n\n the\t islands.  " }),
    ),
    "Across the islands.",
  );
  assert.equal(
    getJourneyDescription(
      journey({
        seoDescription: "  ",
        introduction: "  The\nfallback\tintroduction. ",
      }),
    ),
    "The fallback introduction.",
  );
});

test("description is deterministically bounded to 160 characters", () => {
  const description = normalizeJourneyDescription("word ".repeat(50));

  assert.equal(description.length <= 160, true);
  assert.equal(description.endsWith("…"), true);
  assert.equal(description.slice(0, -1).includes("…"), false);
});

test("dedicated IMAGE ogImage wins with stored dimensions and MIME type", () => {
  assert.deepEqual(selectJourneySocialImage(journey(), siteOrigin), {
    url: dedicatedImage.url,
    alt: dedicatedImage.altText,
    width: 1600,
    height: 900,
    type: "image/jpeg",
  });
});

test("invalid and non-image ogImage values fall back to the cover image", () => {
  const invalidImages: JourneySocialMedia[] = [
    { ...dedicatedImage, type: "VIDEO", mimeType: "video/mp4" },
    { ...dedicatedImage, type: "DOCUMENT", mimeType: "application/pdf" },
    { ...dedicatedImage, url: "http://res.cloudinary.com/insecure.jpg" },
    { ...dedicatedImage, url: "data:image/jpeg;base64,unsafe" },
    { ...dedicatedImage, url: "javascript:alert(1)" },
    { ...dedicatedImage, url: "not a URL" },
    { ...dedicatedImage, mimeType: "image/svg+xml" },
  ];

  for (const ogImage of invalidImages) {
    assert.equal(
      selectJourneySocialImage(journey({ ogImage }), siteOrigin).url,
      coverImage.url,
    );
  }
});

test("unsafe external OG image falls through to the trusted cover", () => {
  const ogImage = {
    ...dedicatedImage,
    url: "https://images.example/external-og.jpg",
  };

  assert.equal(
    selectJourneySocialImage(journey({ ogImage }), siteOrigin).url,
    coverImage.url,
  );
});

test("unsafe OG and cover images fall through to the static placeholder", () => {
  const ogImage = {
    ...dedicatedImage,
    url: "https://images.example/external-og.jpg",
  };
  const coverMedia = {
    ...coverImage,
    url: "http://res.cloudinary.com/wanderstory/image/upload/cover.webp",
  };

  assert.equal(
    selectJourneySocialImage(
      journey({ ogImage, coverMedia }),
      siteOrigin,
    ).url,
    "https://wanderstory.example/hero/placeholder-hero.jpg",
  );
});

test("provider mismatch cannot become OG or Twitter metadata", () => {
  const metadata = buildJourneyMetadata(
    journey({
      ogImage: { ...dedicatedImage, provider: "EXTERNAL" },
    }),
    computedPublicJourneyUrl,
    siteOrigin,
  );
  const serialized = JSON.stringify({
    openGraph: metadata.openGraph,
    twitter: metadata.twitter,
  });

  assert.equal(serialized.includes(dedicatedImage.url), false);
  assert.equal(serialized.includes(coverImage.url), true);
});

test("VIDEO and DOCUMENT rows cannot become metadata with misleading image fields", () => {
  for (const type of ["VIDEO", "DOCUMENT"] as const) {
    const selected = selectJourneySocialImage(
      journey({
        ogImage: {
          ...dedicatedImage,
          type,
          mimeType: "image/jpeg",
        },
      }),
      siteOrigin,
    );

    assert.equal(selected.url, coverImage.url, type);
  }
});

test("cover IMAGE is used when no dedicated ogImage exists", () => {
  assert.deepEqual(
    selectJourneySocialImage(journey({ ogImage: null }), siteOrigin),
    {
      url: coverImage.url,
      alt: coverImage.altText,
      width: 1920,
      height: 1080,
      type: "image/webp",
    },
  );
});

test("static placeholder is an absolute JPEG with fixed fallback metadata", () => {
  assert.deepEqual(
    selectJourneySocialImage(
      journey({ ogImage: null, coverMedia: null }),
      siteOrigin,
    ),
    {
      url: "https://wanderstory.example/hero/placeholder-hero.jpg",
      width: 1920,
      height: 1080,
      type: "image/jpeg",
      alt: "WanderStory",
    },
  );
});

test("metadata keeps canonical override while OG always uses the computed URL", () => {
  const metadata = buildJourneyMetadata(
    journey({ canonicalUrl: "https://editorial.example/island-story" }),
    computedPublicJourneyUrl,
    siteOrigin,
  );
  const openGraph = metadata.openGraph as {
    url?: string;
    siteName?: string;
    type?: string;
  };

  assert.equal(
    metadata.alternates?.canonical,
    "https://editorial.example/island-story",
  );
  assert.equal(openGraph.url, computedPublicJourneyUrl);
  assert.equal(openGraph.siteName, "WanderStory");
  assert.equal(openGraph.type, "article");
});

test("metadata uses the computed URL as canonical without an override", () => {
  const metadata = buildJourneyMetadata(
    journey(),
    computedPublicJourneyUrl,
    siteOrigin,
  );

  assert.equal(metadata.alternates?.canonical, computedPublicJourneyUrl);
});

test("JSON-LD document URL supports canonical override and computed fallback", () => {
  assert.equal(
    resolveJourneyDocumentUrl(
      "https://editorial.example/island-story",
      computedPublicJourneyUrl,
    ),
    "https://editorial.example/island-story",
  );
  assert.equal(
    resolveJourneyDocumentUrl(null, computedPublicJourneyUrl),
    computedPublicJourneyUrl,
  );
});

test("stored structured data cannot overwrite the final JSON-LD URL", () => {
  const jsonLd = buildJourneyArticleJsonLd(
    {
      ...journey({
        canonicalUrl: "https://editorial.example/island-story",
      }),
      travelerName: "A Traveler",
      location: "Cebu",
      publishedAt: "2026-08-01T00:00:00.000Z",
      structuredData: {
        url: "javascript:alert(1)",
        audience: "Travelers",
      },
    },
    computedPublicJourneyUrl,
  );

  assert.equal(jsonLd.url, "https://editorial.example/island-story");
  assert.equal(jsonLd.audience, "Travelers");
});

test("unsafe legacy cover Media is omitted from JSON-LD", () => {
  const unsafeCoverUrl = "https://images.example/legacy-cover.jpg";
  const jsonLd = buildJourneyArticleJsonLd(
    {
      ...journey({
        coverMedia: { ...coverImage, url: unsafeCoverUrl },
      }),
      travelerName: "A Traveler",
      location: "Cebu",
      publishedAt: "2026-08-01T00:00:00.000Z",
      structuredData: null,
    },
    computedPublicJourneyUrl,
  );

  assert.equal("image" in jsonLd, false);
  assert.equal(JSON.stringify(jsonLd).includes(unsafeCoverUrl), false);
});

test("Twitter uses summary_large_image and the shared social fields", () => {
  const metadata = buildJourneyMetadata(
    journey(),
    computedPublicJourneyUrl,
    siteOrigin,
  );
  const twitter = metadata.twitter as {
    card?: string;
    title?: string;
    description?: string;
    images?: unknown;
  };

  assert.equal(twitter.card, "summary_large_image");
  assert.equal(twitter.title, "An Island Story");
  assert.equal(
    twitter.description,
    "A thoughtful journey across the islands.",
  );
  assert.deepEqual(twitter.images, [
    {
      url: dedicatedImage.url,
      alt: dedicatedImage.altText,
      width: 1600,
      height: 900,
      type: "image/jpeg",
    },
  ]);
});

test("Facebook sharer safely encodes Unicode and reserved URL characters", () => {
  const computedUrl =
    "https://wanderstory.example/journeys/Cebu%20%26%20%E6%9D%B1%E4%BA%AC%3Fstory";
  const facebookUrl = buildFacebookShareUrl(computedUrl);
  const parsed = new URL(facebookUrl);

  assert.equal(parsed.origin, "https://www.facebook.com");
  assert.equal(parsed.pathname, "/sharer/sharer.php");
  assert.equal(parsed.searchParams.get("u"), computedUrl);
  assert.match(facebookUrl, /u=https%3A%2F%2F/);
});

test("Facebook receives the computed Journey URL, never canonicalUrl", () => {
  const item = journey({
    canonicalUrl: "https://editorial.example/should-not-be-shared",
  });
  const facebookUrl = buildFacebookShareUrl(computedPublicJourneyUrl);

  assert.equal(
    new URL(facebookUrl).searchParams.get("u"),
    computedPublicJourneyUrl,
  );
  assert.equal(facebookUrl.includes(item.canonicalUrl!), false);
});
