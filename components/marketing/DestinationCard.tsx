import Image from "next/image";
import type { FeaturedDestination } from "@/data/featured-destinations";

interface DestinationCardProps {
  destination: FeaturedDestination;
}

export default function DestinationCard({
  destination,
}: DestinationCardProps) {
  const { title, location, description, imageSrc, imageAlt } = destination;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)] transition-shadow duration-300 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ocean-600)]">
          {location}
        </span>

        <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold leading-snug text-[var(--color-ink-950)]">
          {title}
        </h3>

        <p className="font-[family-name:var(--font-body)] text-sm leading-relaxed text-neutral-500">
          {description}
        </p>
      </div>
    </article>
  );
}
