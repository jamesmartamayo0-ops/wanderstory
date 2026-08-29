import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import JourneyDetail from "@/components/marketing/journey-detail/JourneyDetail";
import { getPublicJourneyBySlug } from "@/services/journey.service";
import { toPublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";
import { serializeJsonLd } from "@/lib/json-ld";

interface JourneyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: JourneyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getPublicJourneyBySlug(slug);

  if (!raw) {
    return { title: "Journey Not Found | WanderStory" };
  }

  const journey = toPublicJourneyDetail(raw);

  return {
    title: journey.seoTitle ?? `${journey.title} | WanderStory`,
    description:
      journey.seoDescription ?? journey.introduction.slice(0, 160),
    alternates: journey.canonicalUrl
      ? { canonical: journey.canonicalUrl }
      : undefined,
    openGraph: {
      title: journey.seoTitle ?? journey.title,
      description: journey.seoDescription ?? journey.introduction.slice(0, 160),
      type: "article",
      images: journey.coverMedia
        ? [{ url: journey.coverMedia.url, alt: journey.coverMedia.altText ?? journey.title }]
        : undefined,
    },
  };
}

export default async function JourneyPage({ params }: JourneyPageProps) {
  const { slug } = await params;
  const raw = await getPublicJourneyBySlug(slug);

  if (!raw) {
    notFound();
  }

  const journey = toPublicJourneyDetail(raw);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: journey.title,
    author: journey.travelerName,
    contentLocation: journey.location,
    datePublished: journey.publishedAt,
    description: journey.seoDescription ?? journey.introduction.slice(0, 160),
    ...(journey.coverMedia && {
      image: journey.coverMedia.url,
    }),
    ...(journey.canonicalUrl && {
      url: journey.canonicalUrl,
    }),
    ...(journey.structuredData && { ...journey.structuredData }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Navbar overMedia />
      <main>
        <JourneyDetail journey={journey} slug={slug} />
      </main>
      <Footer />
    </>
  );
}
