import Image from "next/image";
import type { GalleryItem as GalleryItemType } from "@/data/gallery";

interface GalleryItemProps {
  item: GalleryItemType;
}

export default function GalleryItem({ item }: GalleryItemProps) {
  const { title, location, imageSrc, imageAlt } = item;

  return (
    <article className="group relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)]">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
        />
      </div>

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[var(--color-media-scrim)]/80 via-transparent to-transparent p-5">
        <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-media-caption)]">
          {location}
        </span>

        <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-text-on-media)]">
          {title}
        </h3>
      </div>
    </article>
  );
}
