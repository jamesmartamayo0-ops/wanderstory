interface FeaturedPlaceBlockProps {
  featuredPlace: string | null;
  country: string;
}

export default function FeaturedPlaceBlock({
  featuredPlace,
  country,
}: FeaturedPlaceBlockProps) {
  if (!featuredPlace) return null;

  return (
    <section
      aria-label="Featured place"
      className="bg-[var(--color-ocean-50)] px-6 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-3xl text-center">
        <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-ocean-600)]">
          The place that defines {country}
        </span>

        <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold leading-tight text-[var(--color-ink-950)] sm:text-3xl">
          {featuredPlace}
        </h2>

        <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-sm leading-relaxed text-neutral-500">
          One deliberately curated scene — the view that makes you want to
          book the flight.
        </p>
      </div>
    </section>
  );
}