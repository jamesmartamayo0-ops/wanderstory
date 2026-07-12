import { getFeaturedDestinations } from "@/services/destination.service";
import { toPublicDestination } from "@/lib/adapters/destination.adapter";
import FeaturedDestinationsContent from "./FeaturedDestinationsContent";

export default async function FeaturedDestinations() {
  const raw = await getFeaturedDestinations(6);
  const destinations = raw.map(toPublicDestination);

  return (
    <section
      aria-label="Featured destinations"
      className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center sm:mb-16">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            Curated Places
          </span>

          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-4xl">
            Featured Destinations
          </h2>

          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-neutral-500">
            Handpicked places that define what it means to wander — each one
            chosen for its story, its silence, and its sense of wonder.
          </p>
        </div>

        <FeaturedDestinationsContent destinations={destinations} />
      </div>
    </section>
  );
}
