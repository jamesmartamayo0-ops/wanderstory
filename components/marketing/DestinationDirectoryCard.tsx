import Image from "next/image";
import Link from "next/link";
import type { DestinationCardView } from "@/lib/adapters/destination.adapter";
import { getContinent } from "@/data/continents";
import PhotoCredit from "./PhotoCredit";

interface DestinationDirectoryCardProps {
  destination: DestinationCardView;
  variant?: "default" | "feature";
}

export default function DestinationDirectoryCard({
  destination,
  variant = "default",
}: DestinationDirectoryCardProps) {
  const continent = destination.continent
    ? getContinent(destination.continent)
    : null;
  const isFeature = variant === "feature";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-elevated)] transition-shadow duration-300 hover:shadow-lg motion-reduce:transition-none">
      <Link
        href={`/destinations/${destination.slug}`}
        className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)]"
      >
        <div
          className={`relative overflow-hidden ${
            isFeature ? "aspect-[16/10]" : "aspect-[4/3]"
          }`}
        >
          <Image
            src={destination.imageSrc}
            alt={destination.imageAlt}
            fill
            sizes={
              isFeature
                ? "(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 67vw"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            }
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
          />

          {continent ? (
            <span className="absolute top-3 left-3 rounded-full bg-[var(--color-media-scrim)]/75 px-3 py-1 font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-on-media)] backdrop-blur-sm">
              {continent.name}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-5">
          {destination.featuredPlace ? (
            <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-accent)]">
              {destination.featuredPlace}
            </span>
          ) : null}

          <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold leading-snug text-[var(--color-text-primary)]">
            {destination.title}
          </h3>

          <p className="font-[family-name:var(--font-body)] text-sm leading-relaxed text-[var(--color-text-muted)]">
            {destination.description}
          </p>
        </div>
      </Link>

      {destination.credit ? (
        <PhotoCredit
          credit={destination.credit}
          className="px-5 pt-3 pb-5"
        />
      ) : null}
    </article>
  );
}
