export interface PublicJourneyDetail {
  id: string;
  title: string;
  travelerName: string;
  introduction: string;
  location: string | null;
  travelStartDate: string;
  travelEndDate: string;
  publishedAt: string | null;
  destination: {
    name: string;
    country: string;
    slug: string;
  };
  coverMedia: {
    url: string;
    altText: string | null;
    blurDataUrl: string | null;
    width: number | null;
    height: number | null;
  } | null;
  categories: Array<{
    name: string;
    slug: string;
  }>;
  chapters: Array<{
    id: string;
    title: string;
    order: number;
    content: string;
    location: string | null;
    media: Array<{
      id: string;
      url: string;
      thumbnailUrl: string | null;
      altText: string | null;
      width: number | null;
      height: number | null;
      blurDataUrl: string | null;
    }>;
  }>;
  timelineEvents: Array<{
    id: string;
    date: string;
    title: string;
    description: string | null;
    location: string | null;
    order: number;
  }>;
  quotes: Array<{
    id: string;
    text: string;
    attribution: string | null;
    order: number;
  }>;
  gallery: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    altText: string | null;
    width: number | null;
    height: number | null;
    blurDataUrl: string | null;
  }>;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  structuredData: Record<string, unknown> | null;
}

export function toPublicJourneyDetail(
  journey: Record<string, unknown>
): PublicJourneyDetail {
  const destination = journey.destination as {
    name: string;
    country: string;
    slug: string;
  } | null;
  const coverMedia = journey.coverMedia as {
    url: string;
    altText: string | null;
    blurDataUrl: string | null;
    width: number | null;
    height: number | null;
  } | null;
  const categories = (journey.categories as Array<{
    category: { name: string; slug: string };
  }>) ?? [];
  const chapters = (journey.chapters as Array<Record<string, unknown>>) ?? [];
  const timelineEvents =
    (journey.timelineEvents as Array<Record<string, unknown>>) ?? [];
  const quotes = (journey.quotes as Array<Record<string, unknown>>) ?? [];
  const allMedia =
    (journey.media as Array<Record<string, unknown>>) ?? [];
  const rawStructuredData =
    journey.structuredData as Record<string, unknown> | null;

  return {
    id: journey.id as string,
    title: journey.title as string,
    travelerName: journey.travelerName as string,
    introduction: journey.introduction as string,
    location: (journey.location as string | null) ?? null,
    travelStartDate: new Date(
      journey.travelStartDate as string
    ).toISOString(),
    travelEndDate: new Date(journey.travelEndDate as string).toISOString(),
    publishedAt: journey.publishedAt
      ? new Date(journey.publishedAt as string).toISOString()
      : null,
    destination: {
      name: destination?.name ?? "Unknown",
      country: destination?.country ?? "",
      slug: destination?.slug ?? "",
    },
    coverMedia: coverMedia
      ? {
          url: coverMedia.url,
          altText: coverMedia.altText ?? null,
          blurDataUrl: coverMedia.blurDataUrl ?? null,
          width: coverMedia.width ?? null,
          height: coverMedia.height ?? null,
        }
      : null,
    categories: categories.map((c) => ({
      name: c.category.name,
      slug: c.category.slug,
    })),
    chapters: chapters.map((ch) => {
      const chMedia =
        (ch.media as Array<Record<string, unknown>>) ?? [];
      return {
        id: ch.id as string,
        title: ch.title as string,
        order: ch.order as number,
        content: ch.content as string,
        location: (ch.location as string | null) ?? null,
        media: chMedia.map((m) => ({
          id: m.id as string,
          url: m.url as string,
          thumbnailUrl: (m.thumbnailUrl as string) ?? null,
          altText: (m.altText as string) ?? null,
          width: (m.width as number) ?? null,
          height: (m.height as number) ?? null,
          blurDataUrl: (m.blurDataUrl as string) ?? null,
        })),
      };
    }),
    timelineEvents: timelineEvents.map((e) => ({
      id: e.id as string,
      date: new Date(e.date as string).toISOString(),
      title: e.title as string,
      description: (e.description as string) ?? null,
      location: (e.location as string | null) ?? null,
      order: e.order as number,
    })),
    quotes: quotes.map((q) => ({
      id: q.id as string,
      text: q.text as string,
      attribution: (q.attribution as string) ?? null,
      order: q.order as number,
    })),
    gallery: allMedia
      .filter((m) => m.role === "GALLERY")
      .map((m) => ({
        id: m.id as string,
        url: m.url as string,
        thumbnailUrl: (m.thumbnailUrl as string) ?? null,
        altText: (m.altText as string) ?? null,
        width: (m.width as number) ?? null,
        height: (m.height as number) ?? null,
        blurDataUrl: (m.blurDataUrl as string) ?? null,
      })),
    seoTitle: (journey.seoTitle as string) ?? null,
    seoDescription: (journey.seoDescription as string) ?? null,
    canonicalUrl: (journey.canonicalUrl as string) ?? null,
    structuredData: rawStructuredData,
  };
}
