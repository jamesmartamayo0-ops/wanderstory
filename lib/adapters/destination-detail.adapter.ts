import { toPublicJourney, type PublicJourney } from "./journey.adapter";

export type RelatedJourney = PublicJourney & { slug: string };

export interface PublicDestinationDetail {
  id: string;
  name: string;
  slug: string;
  country: string;
  region: string | null;
  description: string | null;
  heroMedia: {
    url: string;
    altText: string | null;
    blurDataUrl: string | null;
    width: number | null;
    height: number | null;
  } | null;
  relatedJourneys: RelatedJourney[];
}

export function toPublicDestinationDetail(
  destination: Record<string, unknown>
): PublicDestinationDetail {
  const heroMedia = destination.heroMedia as {
    url: string;
    altText: string | null;
    blurDataUrl: string | null;
    width: number | null;
    height: number | null;
  } | null;
  const journeys =
    (destination.journeys as Array<Record<string, unknown>>) ?? [];

  return {
    id: destination.id as string,
    name: destination.name as string,
    slug: destination.slug as string,
    country: destination.country as string,
    region: (destination.region as string) ?? null,
    description: (destination.description as string) ?? null,
    heroMedia: heroMedia
      ? {
          url: heroMedia.url,
          altText: heroMedia.altText ?? null,
          blurDataUrl: heroMedia.blurDataUrl ?? null,
          width: heroMedia.width ?? null,
          height: heroMedia.height ?? null,
        }
      : null,
    relatedJourneys: journeys.map((journey) => ({
      ...toPublicJourney(journey),
      slug: journey.slug as string,
    })),
  };
}
