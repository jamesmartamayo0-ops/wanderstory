import Image from "next/image";
import type { PublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";
import HeroAnimationWrapper from "./HeroAnimationWrapper";
import SaveToggleButton from "@/components/marketing/saved/SaveToggleButton";

interface HeroSectionProps {
  journey: PublicJourneyDetail;
  slug: string;
}

export default function HeroSection({ journey, slug }: HeroSectionProps) {
  const {
    title,
    travelerName,
    destination,
    travelStartDate,
    travelEndDate,
    categories,
    coverMedia,
  } = journey;

  const startDate = new Date(travelStartDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const endDate = new Date(travelEndDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <section
      aria-label="Journey hero"
      className="relative flex min-h-[70vh] items-end overflow-hidden pt-24 pb-16"
    >
      <div className="absolute inset-0">
        {coverMedia ? (
          <Image
            src={coverMedia.url}
            alt={coverMedia.altText ?? title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[var(--color-ocean-600)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink-950)]/85 via-[var(--color-ink-950)]/35 to-transparent" />
      </div>

      <div className="absolute right-6 top-6 z-20">
        <SaveToggleButton
          slug={slug}
          title={title}
          coverUrl={coverMedia?.url ?? null}
          coverAlt={coverMedia?.altText ?? null}
          destinationName={destination.name}
        />
      </div>

      <HeroAnimationWrapper
        title={title}
        travelerName={travelerName}
        destinationName={destination.name}
        destinationCountry={destination.country}
        location={journey.location}
        startDate={startDate}
        endDate={endDate}
        categories={categories}
      />
    </section>
  );
}
