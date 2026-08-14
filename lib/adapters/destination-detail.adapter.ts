import { toPublicJourney, type PublicJourney } from "./journey.adapter";
import { getCountryCode } from "@/data/country-codes";
import { toCredit, type DestinationCredit } from "./destination.adapter";

export type RelatedJourney = PublicJourney & { slug: string };

export interface PublicDestinationDetail {
  id: string;
  name: string;
  slug: string;
  country: string;
  countryCode: string | null;
  continent: string | null;
  featuredPlace: string | null;
  region: string | null;
  description: string | null;
  heroMedia: {
    url: string;
    altText: string | null;
    blurDataUrl: string | null;
    width: number | null;
    height: number | null;
    credit: DestinationCredit | null;
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
    sourceUrl: string | null;
    sourceAuthor: string | null;
    licenseName: string | null;
    licenseUrl: string | null;
  } | null;
  const journeys =
    (destination.journeys as Array<Record<string, unknown>>) ?? [];
  const country = destination.country as string;

  return {
    id: destination.id as string,
    name: destination.name as string,
    slug: destination.slug as string,
    country,
    countryCode: getCountryCode(country),
    continent: (destination.continent as string | null) ?? null,
    featuredPlace: (destination.featuredPlace as string | null) ?? null,
    region: (destination.region as string) ?? null,
    description: (destination.description as string) ?? null,
    heroMedia: heroMedia
      ? {
          url: heroMedia.url,
          altText: heroMedia.altText ?? null,
          blurDataUrl: heroMedia.blurDataUrl ?? null,
          width: heroMedia.width ?? null,
          height: heroMedia.height ?? null,
          credit: toCredit(heroMedia),
        }
      : null,
    relatedJourneys: journeys.map((journey) => ({
      ...toPublicJourney(journey),
      slug: journey.slug as string,
    })),
  };
}