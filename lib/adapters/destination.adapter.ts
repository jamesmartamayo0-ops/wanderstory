import type { FeaturedDestination } from "@/data/featured-destinations";

export type PublicDestination = FeaturedDestination;

export function toPublicDestination(
  destination: Record<string, unknown>
): FeaturedDestination {
  const heroMedia = destination.heroMedia as {
    url: string;
    altText: string | null;
  } | null;
  const region = destination.region as string | null;
  const country = destination.country as string;
  const name = destination.name as string;

  return {
    id: destination.id as string,
    title: name,
    location: region ? `${region}, ${country}` : country,
    description: (destination.description as string | null) ?? "",
    imageSrc: heroMedia?.url ?? "/destinations/placeholder-1.svg",
    imageAlt: heroMedia?.altText ?? name,
  };
}
