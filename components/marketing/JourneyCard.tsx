import Image from "next/image";
import { Calendar, MapPin, BookOpen } from "lucide-react";
import type { PublicJourney } from "@/lib/adapters/journey.adapter";

interface JourneyCardProps {
  journey: PublicJourney;
}

export default function JourneyCard({ journey }: JourneyCardProps) {
  const {
    title,
    travelerName,
    introduction,
    destinationName,
    destinationCountry,
    coverUrl,
    coverAlt,
    chapterCount,
    publishedAt,
  } = journey;

  const publishedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      })
    : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-elevated)] transition-shadow duration-300 hover:shadow-lg motion-reduce:transition-none">
      <div className="relative aspect-[16/9] overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={coverAlt ?? title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-alt)]">
            <BookOpen className="h-12 w-12 text-[var(--color-text-subtle)]" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-link)]">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {destinationName}
            {destinationCountry && `, ${destinationCountry}`}
          </span>

          {publishedDate && (
            <span className="flex items-center gap-1 font-[family-name:var(--font-body)] text-xs text-[var(--color-text-subtle)]">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {publishedDate}
            </span>
          )}
        </div>

        <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold leading-snug text-[var(--color-text-primary)]">
          {title}
        </h3>

        <p className="font-[family-name:var(--font-body)] text-sm leading-relaxed text-[var(--color-text-muted)] line-clamp-3">
          {introduction}
        </p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-[family-name:var(--font-body)] text-xs text-[var(--color-text-subtle)]">
            By {travelerName}
          </span>

          {chapterCount > 0 && (
            <span className="flex items-center gap-1 font-[family-name:var(--font-button)] text-xs font-medium text-[var(--color-text-subtle)]">
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              {chapterCount} {chapterCount === 1 ? "chapter" : "chapters"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
