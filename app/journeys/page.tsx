import type { Metadata } from "next";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import Journeys from "@/components/marketing/Journeys";

export const metadata: Metadata = {
  title: "Journeys | WanderStory",
  description:
    "Real travel adventures from real people — curated routes, honest stories, and the detail that turns a trip into a story.",
};

export default async function JourneysPage() {
  return (
    <>
      <Navbar />
      <main>
        <Journeys />
      </main>
      <Footer />
    </>
  );
}
