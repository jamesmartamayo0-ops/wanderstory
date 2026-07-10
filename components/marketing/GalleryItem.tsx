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
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[var(--color-ink-950)]/70 to-transparent p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
          {location}
        </span>

        <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-white">
          {title}
        </h3>
      </div>
    </article>
  );
}
