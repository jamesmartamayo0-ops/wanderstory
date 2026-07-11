import Image from "next/image";
import type { PublicDestinationDetail } from "@/lib/adapters/destination-detail.adapter";
import HeroAnimationWrapper from "./HeroAnimationWrapper";

interface HeroSectionProps {
  destination: PublicDestinationDetail;
}

export default function HeroSection({ destination }: HeroSectionProps) {
  const { name, country, region, heroMedia } = destination;

  return (
    <section
      aria-label="Destination hero"
      className="relative flex min-h-[70vh] items-end overflow-hidden pt-24 pb-16"
    >
      <div className="absolute inset-0">
        {heroMedia ? (
          <Image
            src={heroMedia.url}
            alt={heroMedia.altText ?? name}
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

      <HeroAnimationWrapper
        name={name}
        country={country}
        region={region}
      />
    </section>
  );
}
