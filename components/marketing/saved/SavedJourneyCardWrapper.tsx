"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, Calendar, Trash2 } from "lucide-react";
import { useSavedJourneys } from "@/lib/hooks/useSavedJourneys";

export default function SavedJourneyCardWrapper() {
  const { saved, unsave } = useSavedJourneys();

  if (saved.length === 0) {
    return (
      <div className="py-24 text-center">
        <Bookmark className="mx-auto h-12 w-12 text-[var(--color-text-subtle)]" aria-hidden="true" />
        <h2 className="mt-4 font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-text-primary)]">
          No saved journeys yet
        </h2>
        <p className="mt-2 font-[family-name:var(--font-body)] text-[var(--color-text-muted)]">
          Browse journeys and save the ones you love.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {saved.map((journey) => {
        const savedDate = new Date(journey.savedAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });

        return (
          <article
            key={journey.slug}
            className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-elevated)] transition-shadow duration-300 hover:shadow-lg motion-reduce:transition-none"
          >
            <Link
              href={`/journeys/${journey.slug}`}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
            >
              <div className="relative aspect-[16/9] overflow-hidden">
                {journey.coverUrl ? (
                  <Image
                    src={journey.coverUrl}
                    alt={journey.coverAlt ?? journey.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-alt)]">
                    <Bookmark className="h-12 w-12 text-[var(--color-text-subtle)]" aria-hidden="true" />
                  </div>
                )}
              </div>
            </Link>

            <div className="flex flex-1 flex-col gap-3 p-5">
              <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-link)]">
                {journey.destinationName}
              </span>

              <Link
                href={`/journeys/${journey.slug}`}
                className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
              >
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold leading-snug text-[var(--color-text-primary)] group-hover:underline">
                  {journey.title}
                </h3>
              </Link>

              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="flex items-center gap-1 font-[family-name:var(--font-body)] text-xs text-[var(--color-text-subtle)]">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  Saved {savedDate}
                </span>

                <button
                  type="button"
                  onClick={() => unsave(journey.slug)}
                  aria-label={`Remove ${journey.title} from saved`}
                  className="rounded-full p-2 text-[var(--color-text-subtle)] transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
