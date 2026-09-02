import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_SAVED_JOURNEYS_STORAGE_KEY,
  loadSavedJourneys,
  SAVED_JOURNEYS_STORAGE_KEY,
  type SavedJourneyStorage,
} from "../lib/saved-journeys-storage";

class MemoryStorage implements SavedJourneyStorage {
  readonly data = new Map<string, string>();
  readonly operations: string[] = [];
  failWrites = false;

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.operations.push(`set:${key}`);
    if (this.failWrites) throw new Error("storage full");
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.operations.push(`remove:${key}`);
    this.data.delete(key);
  }
}

function legacyEntry(coverUrl: string) {
  return {
    slug: "island-story",
    title: "Island Story",
    coverUrl,
    coverAlt: "Island cover",
    destinationName: "Philippines",
    savedAt: "2026-08-01T00:00:00.000Z",
  };
}

test("legacy arbitrary external cover migrates to v2 as null", () => {
  const storage = new MemoryStorage();
  storage.data.set(
    LEGACY_SAVED_JOURNEYS_STORAGE_KEY,
    JSON.stringify([legacyEntry("https://images.example/cover.jpg")]),
  );

  const result = loadSavedJourneys(storage);

  assert.equal(result[0].coverUrl, null);
  assert.deepEqual(JSON.parse(storage.data.get(SAVED_JOURNEYS_STORAGE_KEY)!), result);
});

test("legacy Cloudinary cover also migrates to v2 as null", () => {
  const storage = new MemoryStorage();
  storage.data.set(
    LEGACY_SAVED_JOURNEYS_STORAGE_KEY,
    JSON.stringify([
      legacyEntry(
        "https://res.cloudinary.com/wanderstory/image/upload/legacy.jpg",
      ),
    ]),
  );

  assert.equal(loadSavedJourneys(storage)[0].coverUrl, null);
});

test("legacy migration preserves valid identity and display fields", () => {
  const storage = new MemoryStorage();
  const legacy = legacyEntry("https://images.example/cover.jpg");
  storage.data.set(
    LEGACY_SAVED_JOURNEYS_STORAGE_KEY,
    JSON.stringify([legacy]),
  );

  const [result] = loadSavedJourneys(storage);

  assert.deepEqual(result, { ...legacy, coverUrl: null });
});

test("malformed legacy JSON initializes a safe empty v2 collection", () => {
  const storage = new MemoryStorage();
  storage.data.set(LEGACY_SAVED_JOURNEYS_STORAGE_KEY, "{not-json");

  assert.deepEqual(loadSavedJourneys(storage), []);
  assert.equal(storage.data.get(SAVED_JOURNEYS_STORAGE_KEY), "[]");
  assert.equal(storage.data.has(LEGACY_SAVED_JOURNEYS_STORAGE_KEY), false);
});

test("an existing valid v2 store wins without being overwritten", () => {
  const storage = new MemoryStorage();
  const v2 = [{
    ...legacyEntry(
      "https://res.cloudinary.com/wanderstory/image/upload/current.jpg",
    ),
  }];
  storage.data.set(SAVED_JOURNEYS_STORAGE_KEY, JSON.stringify(v2));
  storage.data.set(
    LEGACY_SAVED_JOURNEYS_STORAGE_KEY,
    JSON.stringify([legacyEntry("https://legacy.example/cover.jpg")]),
  );

  assert.deepEqual(loadSavedJourneys(storage), v2);
  assert.deepEqual(storage.operations, []);
  assert.equal(storage.data.has(LEGACY_SAVED_JOURNEYS_STORAGE_KEY), true);
});

test("legacy key is removed only after v2 persistence succeeds", () => {
  const storage = new MemoryStorage();
  storage.data.set(
    LEGACY_SAVED_JOURNEYS_STORAGE_KEY,
    JSON.stringify([legacyEntry("https://images.example/cover.jpg")]),
  );

  loadSavedJourneys(storage);

  assert.deepEqual(storage.operations, [
    `set:${SAVED_JOURNEYS_STORAGE_KEY}`,
    `remove:${LEGACY_SAVED_JOURNEYS_STORAGE_KEY}`,
  ]);
});

test("failed v2 persistence keeps the legacy key for a retry", () => {
  const storage = new MemoryStorage();
  storage.data.set(
    LEGACY_SAVED_JOURNEYS_STORAGE_KEY,
    JSON.stringify([legacyEntry("https://images.example/cover.jpg")]),
  );
  storage.failWrites = true;

  const result = loadSavedJourneys(storage);

  assert.equal(result[0].coverUrl, null);
  assert.deepEqual(storage.operations, [`set:${SAVED_JOURNEYS_STORAGE_KEY}`]);
  assert.equal(storage.data.has(LEGACY_SAVED_JOURNEYS_STORAGE_KEY), true);
});

test("v2 saved data accepts trusted and null cover URL shapes", () => {
  const storage = new MemoryStorage();
  const v2 = [
    legacyEntry(
      "https://res.cloudinary.com/wanderstory/image/upload/current.jpg",
    ),
    {
      ...legacyEntry("https://unused.example/cover.jpg"),
      slug: "no-cover",
      coverUrl: null,
      coverAlt: null,
    },
  ];
  storage.data.set(SAVED_JOURNEYS_STORAGE_KEY, JSON.stringify(v2));

  assert.deepEqual(loadSavedJourneys(storage), v2);
});
