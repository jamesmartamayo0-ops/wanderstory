import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/marketing/Navbar";
import Footer from "@/components/marketing/Footer";
import JourneyDetail from "@/components/marketing/journey-detail/JourneyDetail";
import { getPublicJourneyBySlug } from "@/services/journey.service";
import { toPublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";
import { serializeJsonLd } from "@/lib/json-ld";
import { buildPublicJourneyUrl, resolveSiteOrigin } from "@/lib/site-url";
import {
  buildJourneyArticleJsonLd,
  buildJourneyMetadata,
} from "@/lib/social-sharing";

interface JourneyPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: JourneyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const raw = await getPublicJourneyBySlug(slug);

  if (!raw) {
    return buildJourneyMetadata(
      null,
      buildPublicJourneyUrl(slug).toString(),
      resolveSiteOrigin(),
    );
  }

  const journey = toPublicJourneyDetail(raw);
  const siteOrigin = resolveSiteOrigin();
  const computedPublicJourneyUrl = buildPublicJourneyUrl(
    slug,
    siteOrigin,
  ).toString();

  return buildJourneyMetadata(journey, computedPublicJourneyUrl, siteOrigin);
}

export default async function JourneyPage({ params }: JourneyPageProps) {
  const { slug } = await params;
  const raw = await getPublicJourneyBySlug(slug);

  if (!raw) {
    notFound();
  }

  const journey = toPublicJourneyDetail(raw);
  const computedPublicJourneyUrl = buildPublicJourneyUrl(slug).toString();

  const jsonLd = buildJourneyArticleJsonLd(
    journey,
    computedPublicJourneyUrl,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Navbar overMedia />
      <main>
        <JourneyDetail
          journey={journey}
          slug={slug}
          publicJourneyUrl={computedPublicJourneyUrl}
        />
      </main>
      <Footer />
    </>
  );
}
