import { getPublicDestinationDirectory } from "@/services/destination.service";
import { toDestinationCard } from "@/lib/adapters/destination.adapter";
import { CONTINENTS } from "@/data/continents";
import ContinentNav from "./ContinentNav";
import DestinationsContent from "./DestinationsContent";
import DestinationSearch from "./destination-search/DestinationSearch";

interface DestinationsProps {
  initialQuery?: string;
}

export default async function Destinations({
  initialQuery = "",
}: DestinationsProps) {
  const raw = await getPublicDestinationDirectory();
  const destinations = raw.map(toDestinationCard);

  const groups = new Map<string, typeof destinations>();
  const uncategorized: typeof destinations = [];

  for (const destination of destinations) {
    if (destination.continent) {
      const group = groups.get(destination.continent) ?? [];
      group.push(destination);
      groups.set(destination.continent, group);
    } else {
      uncategorized.push(destination);
    }
  }

  return (
    <section
      aria-label="Destinations"
      className="min-h-screen bg-[var(--color-surface-alt)] px-6 pt-32 pb-20 sm:pb-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center sm:mb-16">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">
            Explore The World
          </span>

          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            Destinations
          </h1>

          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-[var(--color-text-muted)]">
            Find the place behind the story.
          </p>

          <div className="mx-auto mt-8 max-w-xl">
            <DestinationSearch initialQuery={initialQuery} />
          </div>

          <div className="mt-8">
            <ContinentNav />
          </div>
        </div>

        {destinations.length === 0 ? (
          <DestinationsContent destinations={destinations} />
        ) : (
          <div className="space-y-16">
            {CONTINENTS.map((continent) => {
              const group = groups.get(continent.slug);
              if (!group) return null;

              return (
                <section key={continent.slug} aria-label={continent.name}>
                  <div className="mb-8 text-center">
                    <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[var(--color-text-primary)]">
                      {continent.name}
                    </h2>
                    <p className="mt-1 font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)]">
                      {continent.tagline} · {group.length}{" "}
                      {group.length === 1 ? "country" : "countries"}
                    </p>
                  </div>
                  <DestinationsContent destinations={group} featureFirst />
                </section>
              );
            })}

            {uncategorized.length > 0 ? (
              <section aria-label="More places">
                <div className="mb-8 text-center">
                  <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[var(--color-text-primary)]">
                    More Places
                  </h2>
                  <p className="mt-1 font-[family-name:var(--font-body)] text-sm text-[var(--color-text-muted)]">
                    {uncategorized.length}{" "}
                    {uncategorized.length === 1 ? "destination" : "destinations"}
                  </p>
                </div>
                <DestinationsContent destinations={uncategorized} />
              </section>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
