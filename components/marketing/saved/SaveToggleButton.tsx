"use client";

import { Bookmark } from "lucide-react";
import { useSavedJourneys } from "@/lib/hooks/useSavedJourneys";

interface SaveToggleButtonProps {
  slug: string;
  title: string;
  coverUrl: string | null;
  coverAlt: string | null;
  destinationName: string;
}

export default function SaveToggleButton({
  slug,
  title,
  coverUrl,
  coverAlt,
  destinationName,
}: SaveToggleButtonProps) {
  const { isSaved, save, unsave } = useSavedJourneys();
  const saved = isSaved(slug);

  return (
    <button
      type="button"
      onClick={() =>
        saved
          ? unsave(slug)
          : save({ slug, title, coverUrl, coverAlt, destinationName })
      }
      aria-label={saved ? "Remove from saved" : "Save journey"}
      className={`flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-2 font-[family-name:var(--font-button)] text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-media-scrim)] motion-reduce:transition-none ${
        saved
          ? "bg-[var(--color-sunset-400)] text-[var(--color-text-on-media)] hover:brightness-95"
          : "bg-white/20 text-[var(--color-text-on-media)] backdrop-blur-sm hover:bg-white/30"
      }`}
    >
      <Bookmark
        className={`h-4 w-4 transition-transform duration-300 motion-reduce:transition-none ${
          saved ? "fill-current" : ""
        }`}
        aria-hidden="true"
      />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
