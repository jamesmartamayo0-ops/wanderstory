import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import SavedJourneyCardWrapper from "@/components/marketing/saved/SavedJourneyCardWrapper";

export const metadata: Metadata = {
  title: "Saved Journeys | WanderStory",
  description:
    "Your collection of saved travel adventures and stories.",
};

export default function SavedPage() {
  return (
    <>
      <Navbar />
      <main>
        <section
          aria-label="Saved journeys"
          className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
                Your Collection
              </span>
              <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-4xl">
                Saved Journeys
              </h1>
              <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-neutral-500">
                Stories you have bookmarked for later.
              </p>
            </div>

            <SavedJourneyCardWrapper />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
