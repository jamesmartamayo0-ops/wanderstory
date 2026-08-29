import { getPublicJourneys } from "@/services/journey.service";
import { toPublicJourney } from "@/lib/adapters/journey.adapter";
import JourneysContent from "./JourneysContent";

export default async function Journeys() {
  const raw = await getPublicJourneys();
  const journeys = raw.map(toPublicJourney);

  return (
    <section
      aria-label="Journeys"
      className="min-h-screen bg-[var(--color-surface-alt)] px-6 pt-32 pb-20 sm:pb-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center sm:mb-16">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">
            Latest Adventures
          </span>

          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            Journeys
          </h1>

          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-[var(--color-text-muted)]">
            Follow along on real adventures — curated routes, honest
            storytelling, and the kind of detail that turns a trip into a
            story.
          </p>
        </div>

        <JourneysContent journeys={journeys} />
      </div>
    </section>
  );
}
