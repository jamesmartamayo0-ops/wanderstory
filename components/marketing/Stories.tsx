import { stories } from "@/data/stories";
import StoriesContent from "./StoriesContent";

export default function Stories() {
  return (
    <section
      aria-label="Stories"
      className="min-h-screen bg-[var(--color-surface-alt)] px-6 pt-32 pb-20 sm:pb-28"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center sm:mb-16">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">
            Tales from the Road
          </span>

          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            Stories
          </h1>

          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-[var(--color-text-muted)]">
            Real adventures from real travellers — honest, unpolished, and told
            in their own words.
          </p>
        </div>

        <StoriesContent stories={stories} />
      </div>
    </section>
  );
}
