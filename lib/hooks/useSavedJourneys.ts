"use client";

import { useState, useEffect, useCallback } from "react";
import type { SavedJourney } from "@/lib/types/saved-journey";
import {
  loadSavedJourneys,
  SAVED_JOURNEYS_STORAGE_KEY,
} from "@/lib/saved-journeys-storage";

export function useSavedJourneys() {
  const [saved, setSaved] = useState<SavedJourney[]>([]);

  useEffect(() => {
    try {
      setSaved(loadSavedJourneys(localStorage));
    } catch {
      setSaved([]);
    }
  }, []);

  const isSaved = useCallback(
    (slug: string) => saved.some((j) => j.slug === slug),
    [saved]
  );

  const save = useCallback(
    (journey: Omit<SavedJourney, "savedAt">) => {
      const newItem = { ...journey, savedAt: new Date().toISOString() };
      setSaved((prev) => {
        const updated = [...prev, newItem];
        localStorage.setItem(
          SAVED_JOURNEYS_STORAGE_KEY,
          JSON.stringify(updated)
        );
        return updated;
      });
    },
    []
  );

  const unsave = useCallback(
    (slug: string) => {
      setSaved((prev) => {
        const updated = prev.filter((j) => j.slug !== slug);
        localStorage.setItem(
          SAVED_JOURNEYS_STORAGE_KEY,
          JSON.stringify(updated)
        );
        return updated;
      });
    },
    []
  );

  const remove = unsave;

  return { saved, isSaved, save, unsave, remove };
}
