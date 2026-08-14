import { licenseRequiresAttribution } from "@/lib/attribution";

export interface DestinationCredit {
  author: string;
  licenseName: string;
  licenseUrl: string | null;
  sourceUrl: string | null;
}

export interface DestinationCardView {
  id: string;
  slug: string;
  country: string;
  continent: string | null;
  featuredPlace: string | null;
  region: string | null;
  location: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  credit: DestinationCredit | null;
}

function toCredit(heroMedia: {
  sourceUrl: string | null;
  sourceAuthor: string | null;
  licenseName: string | null;
  licenseUrl: string | null;
}): DestinationCredit | null {
  const licenseName = heroMedia.licenseName ?? "";
  if (!licenseRequiresAttribution(licenseName)) return null;
  if (!heroMedia.sourceAuthor) return null;

  return {
    author: heroMedia.sourceAuthor,
    licenseName,
    licenseUrl: heroMedia.licenseUrl ?? null,
    sourceUrl: heroMedia.sourceUrl ?? null,
  };
}

export { toCredit };

export function toDestinationCard(
  destination: Record<string, unknown>
): DestinationCardView {
  const heroMedia = destination.heroMedia as {
    url: string;
    altText: string | null;
    sourceUrl: string | null;
    sourceAuthor: string | null;
    licenseName: string | null;
    licenseUrl: string | null;
  } | null;
  const country = destination.country as string;
  const name = destination.name as string;
  const region = destination.region as string | null;

  return {
    id: destination.id as string,
    slug: destination.slug as string,
    country,
    continent: (destination.continent as string | null) ?? null,
    featuredPlace: (destination.featuredPlace as string | null) ?? null,
    region,
    location: region ? `${region}, ${country}` : country,
    title: name,
    description: (destination.description as string | null) ?? "",
    imageSrc: heroMedia?.url ?? "/destinations/placeholder-1.svg",
    imageAlt: heroMedia?.altText ?? name,
    credit: heroMedia ? toCredit(heroMedia) : null,
  };
}

export const toPublicDestination = toDestinationCard;
