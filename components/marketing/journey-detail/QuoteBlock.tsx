import type { PublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";

interface QuoteBlockProps {
  quotes: PublicJourneyDetail["quotes"];
}

export default function QuoteBlock({ quotes }: QuoteBlockProps) {
  if (quotes.length === 0) return null;

  return (
    <section
      aria-label="Quotes"
      className="bg-[var(--color-ink-950)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-3xl space-y-12">
        {quotes.map((quote) => (
          <blockquote key={quote.id} className="text-center">
            <p className="font-[family-name:var(--font-heading)] text-2xl font-semibold leading-snug tracking-tight text-white sm:text-3xl">
              &ldquo;{quote.text}&rdquo;
            </p>
            {quote.attribution && (
              <footer className="mt-4 font-[family-name:var(--font-button)] text-sm font-semibold uppercase tracking-wider text-[var(--color-sunset-400)]">
                — {quote.attribution}
              </footer>
            )}
          </blockquote>
        ))}
      </div>
    </section>
  );
}
