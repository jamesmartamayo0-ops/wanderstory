import Image from "next/image";
import type { PublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";
import GalleryAnimationWrapper from "./GalleryAnimationWrapper";

interface GalleryBlockProps {
  gallery: PublicJourneyDetail["gallery"];
}

export default function GalleryBlock({ gallery }: GalleryBlockProps) {
  if (gallery.length === 0) return null;

  return (
    <section
      aria-label="Gallery"
      className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">
            Gallery
          </span>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
            Photo Gallery
          </h2>
        </div>

        <GalleryAnimationWrapper>
          {gallery.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-[var(--radius-card)]"
            >
              <Image
                src={item.url}
                alt={item.altText ?? "Journey photo"}
                width={item.width ?? 800}
                height={item.height ?? 600}
                className="h-auto w-full object-cover"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            </div>
          ))}
        </GalleryAnimationWrapper>
      </div>
    </section>
  );
}
