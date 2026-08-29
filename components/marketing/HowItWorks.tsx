import { howItWorksSteps } from "@/data/how-it-works";
import HowItWorksContent from "./HowItWorksContent";

export default function HowItWorks() {
  return (
    <section
      aria-label="How it works"
      className="bg-[var(--color-surface)] px-6 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center sm:mb-18">
          <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-accent)]">
            Your Journey
          </span>

          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
            How It Works
          </h2>

          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-[var(--color-text-muted)]">
            Three simple steps to turn your wanderlust into an unforgettable
            adventure — from discovery to the road ahead.
          </p>
        </div>

        <HowItWorksContent steps={howItWorksSteps} />
      </div>
    </section>
  );
}
