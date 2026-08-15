import Image from "next/image";
import type { PublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";
import ChapterAnimationWrapper from "./ChapterAnimationWrapper";

interface ChapterBlockProps {
  chapters: PublicJourneyDetail["chapters"];
}

export default function ChapterBlock({ chapters }: ChapterBlockProps) {
  if (chapters.length === 0) return null;

  return (
    <section
      aria-label="Chapters"
      className="bg-[var(--color-surface)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            The Story
          </span>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--color-ink-950)] sm:text-3xl">
            Chapters
          </h2>
        </div>

        <ChapterAnimationWrapper>
          {chapters.map((chapter) => (
            <article key={chapter.id} className="space-y-6">
              <h3 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-ink-950)] sm:text-2xl">
                <span className="text-[var(--color-ocean-500)]">
                  {String(chapter.order).padStart(2, "0")}.
                </span>{" "}
                {chapter.title}
              </h3>

              {chapter.location && (
                <p className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
                  {chapter.location}
                </p>
              )}

              <div className="prose prose-neutral max-w-none font-[family-name:var(--font-body)] text-base leading-relaxed text-[var(--color-ink-950)]/80">
                {chapter.content.split("\n").map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>

              {chapter.media.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {chapter.media.map((media) => (
                    <div
                      key={media.id}
                      className="overflow-hidden rounded-[var(--radius-card)]"
                    >
                      <Image
                        src={media.url}
                        alt={media.altText ?? chapter.title}
                        width={media.width ?? 800}
                        height={media.height ?? 600}
                        className="h-auto w-full object-cover"
                        sizes="(max-width: 640px) 100vw, 50vw"
                      />
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </ChapterAnimationWrapper>
      </div>
    </section>
  );
}
