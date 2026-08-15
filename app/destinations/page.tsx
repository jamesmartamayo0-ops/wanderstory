import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import Destinations from "@/components/marketing/Destinations";

export const metadata: Metadata = {
  title: "Destinations | WanderStory",
  description:
    "Discover places that stir the soul — from misty highlands to sun-scorched deserts, every destination has a story waiting for you.",
};

export default async function DestinationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  return (
    <>
      <Navbar />
      <main>
        <Destinations initialQuery={q ?? ""} />
      </main>
      <Footer />
    </>
  );
}
