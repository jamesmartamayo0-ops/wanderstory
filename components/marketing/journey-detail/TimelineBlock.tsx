import type { PublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";
import TimelineAnimationWrapper from "./TimelineAnimationWrapper";

interface TimelineBlockProps {
  timelineEvents: PublicJourneyDetail["timelineEvents"];
}

export default function TimelineBlock({ timelineEvents }: TimelineBlockProps) {
  if (timelineEvents.length === 0) return null;

  return (
    <section
      aria-label="Timeline"
      className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            Timeline
          </span>
          <h2 className="mt-2 font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--color-ink-950)] sm:text-3xl">
            Journey Highlights
          </h2>
        </div>

        <TimelineAnimationWrapper>
          {timelineEvents.map((event) => {
            const eventDate = new Date(event.date).toLocaleDateString(
              "en-US",
              {
                month: "short",
                day: "numeric",
                year: "numeric",
              }
            );

            return (
              <div key={event.id} className="relative">
                <div className="absolute left-[-29px] top-1.5 h-4 w-4 rounded-full border-2 border-[var(--color-ocean-400)] bg-[var(--color-surface-alt)]" />
                <time className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-wider text-[var(--color-ocean-600)]">
                  {eventDate}
                </time>
                <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-ink-950)]">
                  {event.title}
                </h3>
                {event.location && (
                  <p className="mt-0.5 font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
                    {event.location}
                  </p>
                )}
                {event.description && (
                  <p className="mt-1 font-[family-name:var(--font-body)] text-base leading-relaxed text-[var(--color-ink-950)]/70">
                    {event.description}
                  </p>
                )}
              </div>
            );
          })}
        </TimelineAnimationWrapper>
      </div>
    </section>
  );
}
