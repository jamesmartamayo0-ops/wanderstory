import { galleryItems } from "@/data/gallery";
import GalleryContent from "./GalleryContent";

export default function Gallery() {
  return (
    <section
      aria-label="Gallery"
      className="bg-[var(--color-surface)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center sm:mb-16">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            Visual Stories
          </span>

          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-4xl">
            Gallery
          </h1>

          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-neutral-500">
            A glimpse into the places and moments that define the WanderStory
            experience.
          </p>
        </div>

        <GalleryContent items={galleryItems} />
      </div>
    </section>
  );
}
