import assert from "node:assert/strict";
import { mock } from "node:test";
import test, { before } from "node:test";
import { buildJourneyMetadata } from "../lib/social-sharing";
import { buildPublicJourneyUrl } from "../lib/site-url";

let publicQueryArguments: Record<string, unknown> | null = null;
let publicListQueryArguments: Record<string, unknown> | null = null;
let publicDestinationQueryArguments: Record<string, unknown> | null = null;

const prisma = {
  journey: {
    findFirst: async (arguments_: Record<string, unknown>) => {
      publicQueryArguments = arguments_;
      return null;
    },
    findMany: async (arguments_: Record<string, unknown>) => {
      publicListQueryArguments = arguments_;
      return [];
    },
  },
  destination: {
    findUnique: async (arguments_: Record<string, unknown>) => {
      publicDestinationQueryArguments = arguments_;
      return null;
    },
  },
};

type MockModule = (
  specifier: string,
  options: { exports: Record<string, unknown> },
) => unknown;
const mockModule = (mock as unknown as { module: MockModule }).module.bind(mock);

mockModule("../lib/prisma", {
  exports: { default: prisma, prisma },
});
mockModule("../services/media.service", {
  exports: { purgeMediaAssets: async () => undefined },
});

let journeyService!: typeof import("../services/journey.service");
let destinationService!: typeof import("../services/destination.service");
before(async () => {
  journeyService = await import("../services/journey.service");
  destinationService = await import("../services/destination.service");
});

test("public Journey query requires published, public, consented records", async () => {
  await journeyService.getPublicJourneyBySlug("island-story");

  const where = publicQueryArguments?.where as Record<string, unknown>;
  assert.deepEqual(where, {
    slug: "island-story",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    publicationConsent: { consentGiven: true },
  });
});

test("public Journey query selects social images but never privateToken", async () => {
  await journeyService.getPublicJourneyBySlug("island-story");

  const select = publicQueryArguments?.select as Record<string, unknown>;
  assert.equal(Object.hasOwn(select, "privateToken"), false);
  assert.deepEqual(select.coverMedia, {
    select: {
      url: true,
      provider: true,
      altText: true,
      blurDataUrl: true,
      width: true,
      height: true,
      mimeType: true,
      type: true,
    },
  });
  assert.deepEqual(select.ogImage, {
    select: {
      url: true,
      provider: true,
      altText: true,
      width: true,
      height: true,
      mimeType: true,
      type: true,
    },
  });
});

test("public Journey list keeps visibility rules and selects cover trust fields", async () => {
  await journeyService.getPublicJourneys();

  assert.deepEqual(publicListQueryArguments?.where, {
    status: "PUBLISHED",
    visibility: "PUBLIC",
    publicationConsent: { consentGiven: true },
  });
  const include = publicListQueryArguments?.include as Record<string, unknown>;
  assert.deepEqual(include.coverMedia, {
    select: {
      url: true,
      provider: true,
      type: true,
      mimeType: true,
      altText: true,
    },
  });
});

test("public Destination related Journeys select cover trust fields", async () => {
  await destinationService.getPublicDestinationBySlug("philippines");

  assert.deepEqual(publicDestinationQueryArguments?.where, {
    slug: "philippines",
    published: true,
  });
  const select = publicDestinationQueryArguments?.select as Record<string, unknown>;
  const journeys = select.journeys as {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  };
  assert.deepEqual(journeys.where, {
    status: "PUBLISHED",
    visibility: "PUBLIC",
    publicationConsent: { consentGiven: true },
  });
  assert.deepEqual(journeys.select.coverMedia, {
    select: {
      url: true,
      provider: true,
      type: true,
      mimeType: true,
      altText: true,
    },
  });
});

test("inaccessible Journey metadata contains no Journey-specific social data", () => {
  const metadata = buildJourneyMetadata(
    null,
    "https://wanderstory.example/journeys/private-story",
    new URL("https://wanderstory.example"),
  );
  const serialized = JSON.stringify(metadata);

  assert.deepEqual(metadata, {
    title: "Journey Not Found | WanderStory",
    robots: { index: false, follow: false },
  });
  assert.equal(serialized.includes("private-story"), false);
  assert.equal("openGraph" in metadata, false);
  assert.equal("twitter" in metadata, false);
  assert.equal("alternates" in metadata, false);
});

test("privateToken is never an input to the computed public share URL", () => {
  const record = {
    slug: "island-story",
    privateToken: "secret-preview-token",
  };
  const publicUrl = buildPublicJourneyUrl(
    record.slug,
    new URL("https://wanderstory.example"),
  ).toString();

  assert.equal(publicUrl, "https://wanderstory.example/journeys/island-story");
  assert.equal(publicUrl.includes(record.privateToken), false);
});
