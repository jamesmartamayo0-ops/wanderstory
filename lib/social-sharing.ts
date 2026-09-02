import type { Metadata } from "next";
import {
  isTrustedJourneyImageMedia,
  type JourneyMediaTrustFields,
} from "./journey-media-trust";

const MAX_DESCRIPTION_LENGTH = 160;
const PLACEHOLDER_IMAGE_PATH = "/hero/placeholder-hero.jpg";

export interface JourneySocialMedia extends JourneyMediaTrustFields {
  url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  mimeType: string | null;
}

export interface JourneySocialMetadataInput {
  title: string;
  introduction: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  ogImage: JourneySocialMedia | null;
  coverMedia: JourneySocialMedia | null;
}

export interface JourneySocialImage {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  type?: string;
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeJourneyDescription(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= MAX_DESCRIPTION_LENGTH) return normalized;

  return `${normalized.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`;
}

export function getJourneyMetadataTitle(
  journey: Pick<JourneySocialMetadataInput, "title" | "seoTitle">,
): string {
  return nonEmpty(journey.seoTitle) ?? `${journey.title} | WanderStory`;
}

export function getJourneySocialTitle(
  journey: Pick<JourneySocialMetadataInput, "title" | "seoTitle">,
): string {
  return nonEmpty(journey.seoTitle) ?? journey.title;
}

export function getJourneyDescription(
  journey: Pick<
    JourneySocialMetadataInput,
    "introduction" | "seoDescription"
  >,
): string {
  return normalizeJourneyDescription(
    nonEmpty(journey.seoDescription) ?? journey.introduction,
  );
}

function isPositiveDimension(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function toSocialImage(
  media: JourneySocialMedia | null,
  fallbackAlt: string,
): JourneySocialImage | null {
  if (!media || !isTrustedJourneyImageMedia(media)) return null;

  return {
    url: media.url,
    alt: nonEmpty(media.altText) ?? fallbackAlt,
    ...(isPositiveDimension(media.width) && { width: media.width }),
    ...(isPositiveDimension(media.height) && { height: media.height }),
    type: media.mimeType!,
  };
}

export function selectJourneySocialImage(
  journey: Pick<
    JourneySocialMetadataInput,
    "title" | "ogImage" | "coverMedia"
  >,
  siteOrigin: URL,
): JourneySocialImage {
  return (
    toSocialImage(journey.ogImage, journey.title) ??
    toSocialImage(journey.coverMedia, journey.title) ?? {
      url: new URL(PLACEHOLDER_IMAGE_PATH, siteOrigin).toString(),
      width: 1920,
      height: 1080,
      type: "image/jpeg",
      alt: "WanderStory",
    }
  );
}

export function buildJourneyMetadata(
  journey: JourneySocialMetadataInput | null,
  computedPublicJourneyUrl: string,
  siteOrigin: URL,
): Metadata {
  if (!journey) {
    return {
      title: "Journey Not Found | WanderStory",
      robots: { index: false, follow: false },
    };
  }

  const description = getJourneyDescription(journey);
  const socialTitle = getJourneySocialTitle(journey);
  const socialImage = selectJourneySocialImage(journey, siteOrigin);

  return {
    title: getJourneyMetadataTitle(journey),
    description,
    alternates: {
      canonical: journey.canonicalUrl ?? computedPublicJourneyUrl,
    },
    openGraph: {
      title: socialTitle,
      description,
      url: computedPublicJourneyUrl,
      siteName: "WanderStory",
      type: "article",
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [socialImage],
    },
  };
}

export function resolveJourneyDocumentUrl(
  canonicalUrl: string | null,
  computedPublicJourneyUrl: string,
): string {
  return canonicalUrl ?? computedPublicJourneyUrl;
}

export interface JourneyArticleJsonLdInput {
  title: string;
  travelerName: string;
  location: string | null;
  publishedAt: string | null;
  seoDescription: string | null;
  introduction: string;
  coverMedia: JourneySocialMedia | null;
  canonicalUrl: string | null;
  structuredData: Record<string, unknown> | null;
}

export function buildJourneyArticleJsonLd(
  journey: JourneyArticleJsonLdInput,
  computedPublicJourneyUrl: string,
): Record<string, unknown> {
  const trustedCoverImage = toSocialImage(journey.coverMedia, journey.title);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: journey.title,
    author: journey.travelerName,
    contentLocation: journey.location,
    datePublished: journey.publishedAt,
    description: journey.seoDescription ?? journey.introduction.slice(0, 160),
    ...(trustedCoverImage && {
      image: trustedCoverImage.url,
    }),
    ...(journey.structuredData && { ...journey.structuredData }),
    url: resolveJourneyDocumentUrl(
      journey.canonicalUrl,
      computedPublicJourneyUrl,
    ),
  };
}

export function buildFacebookShareUrl(computedPublicJourneyUrl: string): string {
  const facebookUrl = new URL("https://www.facebook.com/sharer/sharer.php");
  facebookUrl.searchParams.set("u", computedPublicJourneyUrl);
  return facebookUrl.toString();
}
