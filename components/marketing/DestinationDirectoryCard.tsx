import Image from "next/image";
import type { DestinationCardView } from "@/lib/adapters/destination.adapter";
import { getContinent } from "@/data/continents";
import PhotoCredit from "./PhotoCredit";

interface DestinationDirectoryCardProps {
  destination: DestinationCardView;
}

export default function DestinationDirectoryCard({
  destination,
}: DestinationDirectoryCardProps) {
  const continent = destination.continent
    ? getContinent(destination.continent)
    : null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)] transition-shadow duration-300 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={destination.imageSrc}
          alt={destination.imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {continent ? (
          <span className="absolute top-3 left-3 rounded-full bg-[var(--color-ink-950)]/70 px-3 py-1 font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            {continent.name}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        {destination.featuredPlace ? (
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-sunset-500)]">
            {destination.featuredPlace}
          </span>
        ) : null}

        <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold leading-snug text-[var(--color-ink-950)]">
          {destination.title}
        </h3>

        <p className="font-[family-name:var(--font-body)] text-sm leading-relaxed text-neutral-500">
          {destination.description}
        </p>

        {destination.credit ? (
          <PhotoCredit credit={destination.credit} className="mt-auto pt-3" />
        ) : null}
      </div>
    </article>
  );
}
