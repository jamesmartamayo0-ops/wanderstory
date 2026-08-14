import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import ContinentNav from "@/components/marketing/ContinentNav";
import DestinationsContent from "@/components/marketing/DestinationsContent";
import { CONTINENTS, getContinent } from "@/data/continents";
import { getPublicDestinationsByContinent } from "@/services/destination.service";
import { toDestinationCard } from "@/lib/adapters/destination.adapter";

interface ContinentPageProps {
  params: Promise<{ continent: string }>;
}

export function generateStaticParams() {
  return CONTINENTS.map((continent) => ({ continent: continent.slug }));
}

export async function generateMetadata({
  params,
}: ContinentPageProps): Promise<Metadata> {
  const { continent } = await params;
  const match = getContinent(continent);

  if (!match) {
    return { title: "Continent Not Found | WanderStory" };
  }

  return {
    title: `${match.name} Destinations | WanderStory`,
    description: `Curated places to visit in ${match.name} — ${match.tagline}.`,
  };
}

export default async function ContinentPage({
  params,
}: ContinentPageProps) {
  const { continent } = await params;
  const match = getContinent(continent);

  if (!match) {
    notFound();
  }

  const raw = await getPublicDestinationsByContinent(continent);
  const destinations = raw.map(toDestinationCard);

  return (
    <>
      <Navbar />
      <main>
        <section
          aria-label={`${match.name} destinations`}
          className="bg-[var(--color-surface-alt)] px-6 py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center sm:mb-16">
              <span className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]">
                Explore The World
              </span>

              <h1 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight tracking-tight text-[var(--color-ink-950)] sm:text-4xl">
                {match.name}
              </h1>

              <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-body)] text-base text-neutral-500">
                {match.tagline} · {destinations.length}{" "}
                {destinations.length === 1 ? "country" : "countries"}
              </p>

              <div className="mt-8">
                <ContinentNav activeSlug={match.slug} />
              </div>
            </div>

            <DestinationsContent destinations={destinations} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}