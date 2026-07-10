export interface PublicJourney {
  id: string;
  title: string;
  travelerName: string;
  introduction: string;
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
    altText: string | null;
  } | null;
  const chapterCount =
    (journey._count as { chapters: number } | null)?.chapters ?? 0;
  const publishedAt = journey.publishedAt
    ? new Date(journey.publishedAt as string).toISOString()
    : null;

  return {
    id: journey.id as string,
    title: journey.title as string,
    travelerName: journey.travelerName as string,
    introduction: journey.introduction as string,
    destinationName: destination?.name ?? "Unknown",
    destinationCountry: destination?.country ?? "",
    coverUrl: coverMedia?.url ?? null,
    coverAlt: coverMedia?.altText ?? null,
    chapterCount,
    publishedAt,
  };
}
