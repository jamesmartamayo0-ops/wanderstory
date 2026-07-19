"use client";

import { useState, useEffect, useCallback } from "react";
import type { SavedJourney } from "@/lib/types/saved-journey";

const STORAGE_KEY = "wanderstory:saved-journeys";

export function useSavedJourneys() {
  const [saved, setSaved] = useState<SavedJourney[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSaved(JSON.parse(stored));
      }
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const unsave = useCallback(
    (slug: string) => {
      setSaved((prev) => {
        const updated = prev.filter((j) => j.slug !== slug);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const remove = unsave;

  return { saved, isSaved, save, unsave, remove };
}
