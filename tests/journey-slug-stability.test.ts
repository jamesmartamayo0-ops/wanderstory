import assert from "node:assert/strict";
import { mock } from "node:test";
import test, { before } from "node:test";

type JourneyStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type JourneyRecord = {
  id: string;
  title: string;
  slug: string;
  status: JourneyStatus;
  publishedAt: Date | null;
};

const journeyId = "journey-1";
let storedJourney: JourneyRecord;
let slugOwners: Map<string, string>;
let slugLookups: string[];
let lastUpdateData: Record<string, unknown>;

function resetJourney(overrides: Partial<JourneyRecord> = {}) {
  storedJourney = {
    id: journeyId,
    title: "Original Journey",
    slug: "original-journey",
    status: "DRAFT",
    publishedAt: null,
    ...overrides,
  };
  slugOwners = new Map([[storedJourney.slug, storedJourney.id]]);
  slugLookups = [];
  lastUpdateData = {};
}

const transactionClient = {
  journeyCategory: {
    deleteMany: async () => ({ count: 0 }),
    createMany: async () => ({ count: 0 }),
  },
  journey: {
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      assert.equal(where.id, storedJourney.id);
      lastUpdateData = { ...data };
      storedJourney = { ...storedJourney, ...data } as JourneyRecord;
      return { ...storedJourney };
    },
  },
};

const prisma = {
  journey: {
    findUnique: async ({
      where,
      select,
    }: {
      where: { id?: string; slug?: string };
      select?: { publishedAt?: boolean };
    }) => {
      if (where.id !== undefined) {
        if (where.id !== storedJourney.id) return null;
        if (select?.publishedAt) {
          return { publishedAt: storedJourney.publishedAt };
        }
        return { ...storedJourney };
      }

      assert.ok(where.slug);
      slugLookups.push(where.slug);
      const ownerId = slugOwners.get(where.slug);
      return ownerId ? { id: ownerId } : null;
    },
  },
  $transaction: async <T>(
    callback: (tx: typeof transactionClient) => Promise<T>,
  ) => callback(transactionClient),
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
before(async () => {
  journeyService = await import("../services/journey.service");
});

test("a never-published journey still regenerates its slug after a title change", async () => {
  resetJourney();

  const result = await journeyService.updateJourney(journeyId, {
    title: "A Fresh Journey",
  });

  assert.equal(result.success, true);
  assert.equal(storedJourney.title, "A Fresh Journey");
  assert.equal(storedJourney.slug, "a-fresh-journey");
  assert.equal(lastUpdateData.slug, "a-fresh-journey");
});

test("a published journey preserves its stored slug after a title change", async () => {
  resetJourney({
    status: "PUBLISHED",
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
  });

  const result = await journeyService.updateJourney(journeyId, {
    title: "Published Journey Retitled",
  });

  assert.equal(result.success, true);
  assert.equal(storedJourney.title, "Published Journey Retitled");
  assert.equal(storedJourney.slug, "original-journey");
  assert.equal("slug" in lastUpdateData, false);
  assert.deepEqual(slugLookups, []);
});

test("an archived historically published journey preserves its stored slug", async () => {
  resetJourney({
    status: "ARCHIVED",
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
  });

  const result = await journeyService.updateJourney(journeyId, {
    title: "Archived Journey Retitled",
  });

  assert.equal(result.success, true);
  assert.equal(storedJourney.title, "Archived Journey Retitled");
  assert.equal(storedJourney.slug, "original-journey");
  assert.equal("slug" in lastUpdateData, false);
  assert.deepEqual(slugLookups, []);
});

test("a never-published title change retains unique-slug collision handling", async () => {
  resetJourney();
  slugOwners.set("a-fresh-journey", "journey-2");
  slugOwners.set("a-fresh-journey-1", "journey-3");

  const result = await journeyService.updateJourney(journeyId, {
    title: "A Fresh Journey",
  });

  assert.equal(result.success, true);
  assert.equal(storedJourney.slug, "a-fresh-journey-2");
  assert.deepEqual(slugLookups, [
    "a-fresh-journey",
    "a-fresh-journey-1",
    "a-fresh-journey-2",
  ]);
});
