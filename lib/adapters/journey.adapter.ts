import { isTrustedJourneyImageMedia } from "../journey-media-trust";

export interface PublicJourney {
  id: string;
  slug: string;
  title: string;
  travelerName: string;
  introduction: string;
  location: string | null;
  destinationName: string;
  destinationCountry: string;
  coverUrl: string | null;
  coverAlt: string | null;
  chapterCount: number;
  publishedAt: string | null;
}

export function toPublicJourney(
  journey: Record<string, unknown>
): PublicJourney {
  const destination = journey.destination as {
    name: string;
    country: string;
  } | null;
  const coverMedia = journey.coverMedia as {
    url: string;
    provider: string;
    type: "IMAGE" | "VIDEO" | "DOCUMENT";
    mimeType: string | null;
    altText: string | null;
  } | null;
  const trustedCoverMedia = isTrustedJourneyImageMedia(coverMedia)
    ? coverMedia
    : null;
  const chapterCount =
    (journey._count as { chapters: number } | null)?.chapters ?? 0;
  const publishedAt = journey.publishedAt
    ? new Date(journey.publishedAt as string).toISOString()
    : null;

  return {
    id: journey.id as string,
    slug: journey.slug as string,
    title: journey.title as string,
    travelerName: journey.travelerName as string,
    introduction: journey.introduction as string,
    location: (journey.location as string | null) ?? null,
    destinationName: destination?.name ?? "Unknown",
    destinationCountry: destination?.country ?? "",
    coverUrl: trustedCoverMedia?.url ?? null,
    coverAlt: trustedCoverMedia?.altText ?? null,
    chapterCount,
    publishedAt,
  };
}
