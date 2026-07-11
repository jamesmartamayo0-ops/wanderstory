import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import DestinationDetail from "@/components/marketing/destination-detail/DestinationDetail";
import { getPublicDestinationBySlug } from "@/services/destination.service";
import { toPublicDestinationDetail } from "@/lib/adapters/destination-detail.adapter";

interface DestinationPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: DestinationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getPublicDestinationBySlug(slug);

  if (!raw) {
    return { title: "Destination Not Found | WanderStory" };
  }

  const destination = toPublicDestinationDetail(raw);

  return {
    title: `${destination.name} | WanderStory`,
    description: destination.description?.slice(0, 160) ?? undefined,
  };
}

export default async function DestinationPage({
  params,
}: DestinationPageProps) {
  const { slug } = await params;
  const raw = await getPublicDestinationBySlug(slug);

  if (!raw) {
    notFound();
  }

  const destination = toPublicDestinationDetail(raw);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: destination.name,
    description: destination.description?.slice(0, 160),
    ...(destination.heroMedia && {
      image: destination.heroMedia.url,
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <DestinationDetail destination={destination} />
      </main>
      <Footer />
    </>
  );
}
