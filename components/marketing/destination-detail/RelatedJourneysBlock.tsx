import Link from "next/link";
import JourneyCard from "@/components/marketing/JourneyCard";
import type { RelatedJourney } from "@/lib/adapters/destination-detail.adapter";

interface RelatedJourneysBlockProps {
  journeys: RelatedJourney[];
}

export default function RelatedJourneysBlock({
  journeys,
}: RelatedJourneysBlockProps) {
  if (journeys.length === 0) return null;

  return (
    <section
      aria-label="Related journeys"
      className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            Journeys
          </span>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--color-ink-950)] sm:text-3xl">
            Related Journeys
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {journeys.map((journey) => (
            <Link
              key={journey.id}
              href={`/journeys/${journey.slug}`}
              className="transition-opacity duration-300 hover:opacity-90"
            >
              <JourneyCard journey={journey} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
