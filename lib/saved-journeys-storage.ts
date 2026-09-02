import type { SavedJourney } from "./types/saved-journey";

export const LEGACY_SAVED_JOURNEYS_STORAGE_KEY =
  "wanderstory:saved-journeys";
export const SAVED_JOURNEYS_STORAGE_KEY = "wanderstory:saved-journeys:v2";

export interface SavedJourneyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toSavedJourney(value: unknown): SavedJourney | null {
  if (
    !isRecord(value) ||
    typeof value.slug !== "string" ||
    typeof value.title !== "string" ||
    typeof value.destinationName !== "string" ||
    typeof value.savedAt !== "string" ||
    (value.coverUrl !== null && typeof value.coverUrl !== "string") ||
    (value.coverAlt !== null && typeof value.coverAlt !== "string")
  ) {
    return null;
  }

  return {
    slug: value.slug,
    title: value.title,
    coverUrl: value.coverUrl,
    coverAlt: value.coverAlt,
    destinationName: value.destinationName,
    savedAt: value.savedAt,
  };
}

function parseSavedJourneys(raw: string): SavedJourney[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const journeys = parsed.map(toSavedJourney);
    return journeys.every((journey): journey is SavedJourney => journey !== null)
      ? journeys
      : null;
  } catch {
    return null;
  }
}

function migrateLegacySavedJourneys(raw: string): SavedJourney[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((value) => {
      if (
        !isRecord(value) ||
        typeof value.slug !== "string" ||
        typeof value.title !== "string" ||
        typeof value.destinationName !== "string" ||
        typeof value.savedAt !== "string"
      ) {
        return [];
      }

      return [{
        slug: value.slug,
        title: value.title,
        coverUrl: null,
        coverAlt: typeof value.coverAlt === "string" ? value.coverAlt : null,
        destinationName: value.destinationName,
        savedAt: value.savedAt,
      } satisfies SavedJourney];
    });
  } catch {
    return [];
  }
}

export function loadSavedJourneys(
  storage: SavedJourneyStorage,
): SavedJourney[] {
  let v2Raw: string | null;
  try {
    v2Raw = storage.getItem(SAVED_JOURNEYS_STORAGE_KEY);
  } catch {
    return [];
  }

  if (v2Raw !== null) {
    return parseSavedJourneys(v2Raw) ?? [];
  }

  let legacyRaw: string | null;
  try {
    legacyRaw = storage.getItem(LEGACY_SAVED_JOURNEYS_STORAGE_KEY);
  } catch {
    return [];
  }

  if (legacyRaw === null) return [];

  const migrated = migrateLegacySavedJourneys(legacyRaw);

  try {
    storage.setItem(SAVED_JOURNEYS_STORAGE_KEY, JSON.stringify(migrated));
    storage.removeItem(LEGACY_SAVED_JOURNEYS_STORAGE_KEY);
  } catch {
    // Keep the legacy key when v2 persistence fails so migration can retry.
  }

  return migrated;
}
