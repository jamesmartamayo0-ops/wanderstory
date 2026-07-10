import Image from "next/image";
import type { StoryItem } from "@/data/stories";

interface StoryCardProps {
  story: StoryItem;
}

export default function StoryCard({ story }: StoryCardProps) {
  const { title, author, location, excerpt, imageSrc, imageAlt } = story;

  return (
    <article className="flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-elevated)] transition-shadow duration-300 hover:shadow-lg sm:flex-row">
      <div className="relative h-48 w-full shrink-0 sm:h-auto sm:w-56">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 224px"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col justify-center gap-2 p-5">
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ocean-600)]">
            {location}
          </span>

          <span className="text-xs text-neutral-300">|</span>

          <span className="font-[family-name:var(--font-body)] text-xs text-neutral-400">
            {author}
          </span>
        </div>

        <h3 className="font-[family-name:var(--font-heading)] text-lg font-semibold leading-snug text-[var(--color-ink-950)]">
          {title}
        </h3>

        <p className="font-[family-name:var(--font-body)] text-sm leading-relaxed text-neutral-500">
          &ldquo;{excerpt}&rdquo;
        </p>
      </div>
    </article>
  );
}
