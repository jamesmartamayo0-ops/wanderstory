import { getPublicDestinations } from "@/services/destination.service";
import { toPublicDestination } from "@/lib/adapters/destination.adapter";
import DestinationsContent from "./DestinationsContent";

export default async function Destinations() {
  const raw = await getPublicDestinations();
  const destinations = raw.map(toPublicDestination);

  return (
    <section
      aria-label="Destinations"
      className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center sm:mb-16">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            Explore The World
          </span>

          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-4xl">
            Destinations
          </h1>

          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-neutral-500">
            Discover places that stir the soul — from misty highlands to
            sun-scorched deserts, every destination has a story waiting for you.
          </p>
        </div>

        <DestinationsContent destinations={destinations} />
      </div>
    </section>
  );
}
