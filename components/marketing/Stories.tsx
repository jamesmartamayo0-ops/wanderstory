import { stories } from "@/data/stories";
import StoriesContent from "./StoriesContent";

export default function Stories() {
  return (
    <section
      aria-label="Stories"
      className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center sm:mb-16">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
            Tales from the Road
          </span>

          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-4xl">
            Stories
          </h1>

          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-neutral-500">
            Real adventures from real travellers — honest, unpolished, and told
            in their own words.
          </p>
        </div>

        <StoriesContent stories={stories} />
      </div>
    </section>
  );
}
