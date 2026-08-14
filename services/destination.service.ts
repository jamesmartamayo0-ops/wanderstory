import prisma from "../lib/prisma";
import { generateSlug, ensureUniqueSlug } from "../lib/slug";
import type {
  CreateDestinationInput,
  UpdateDestinationInput,
} from "../lib/validation/destination.schema";
import type { ActionResult } from "../types";

export async function getAllDestinations() {
  return prisma.destination.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { journeys: true } } },
  });
}

export async function getDestinationById(id: string) {
  return prisma.destination.findUnique({
    where: { id },
    include: { heroMedia: true },
  });
}

export async function getDestinationBySlug(slug: string) {
  return prisma.destination.findUnique({ where: { slug } });
}

export async function createDestination(
  data: CreateDestinationInput
): Promise<ActionResult> {
  try {
    const baseSlug = generateSlug(data.name);
    const slug = await ensureUniqueSlug(baseSlug, (s) =>
      prisma.destination.findUnique({ where: { slug: s } })
    );

    const destination = await prisma.destination.create({
      data: { ...data, slug },
    });
    return { success: true, data: destination };
  } catch {
    return { success: false, error: "Failed to create destination" };
  }
}

export async function updateDestination(
  id: string,
  data: UpdateDestinationInput
): Promise<ActionResult> {
  try {
    const updateData: Record<string, unknown> = { ...data };

    if (data.name) {
      const baseSlug = generateSlug(data.name);
      updateData.slug = await ensureUniqueSlug(baseSlug, (s) =>
        prisma.destination.findUnique({ where: { slug: s } }),
        id
      );
    }

    // convert empty string media ID to null for Prisma
    if (updateData.heroMediaId === "") updateData.heroMediaId = null;

    const destination = await prisma.destination.update({
      where: { id },
      data: updateData,
    });
    return { success: true, data: destination };
  } catch {
    return { success: false, error: "Failed to update destination" };
  }
}

export async function deleteDestination(id: string): Promise<ActionResult> {
  try {
    const existing = await prisma.destination.findUnique({
      where: { id },
      include: { journeys: { take: 1 } },
    });

    if (!existing) {
      return { success: false, error: "Destination not found" };
    }

    if (existing.journeys.length > 0) {
      return {
        success: false,
        error: "Cannot delete destination with associated journeys",
      };
    }

    await prisma.destination.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete destination" };
  }
}

export async function updateDestinationPublished(
  id: string,
  published: boolean
): Promise<ActionResult> {
  try {
    await prisma.destination.update({ where: { id }, data: { published } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update destination status" };
  }
}

export async function getPublicDestinationBySlug(slug: string) {
  try {
    const destination = await prisma.destination.findUnique({
      where: { slug, published: true },
      select: {
        id: true,
        name: true,
        slug: true,
        country: true,
        continent: true,
        featuredPlace: true,
        region: true,
        description: true,
        heroMedia: {
          select: {
            url: true,
            altText: true,
            blurDataUrl: true,
            width: true,
            height: true,
            sourceUrl: true,
            sourceAuthor: true,
            licenseName: true,
            licenseUrl: true,
          },
        },
        journeys: {
          where: {
            status: "PUBLISHED",
            visibility: "PUBLIC",
            publicationConsent: { consentGiven: true },
          },
          orderBy: { publishedAt: "desc" },
          select: {
            id: true,
            slug: true,
            title: true,
            travelerName: true,
            introduction: true,
            publishedAt: true,
            destination: {
              select: { name: true, country: true },
            },
            coverMedia: {
              select: { url: true, altText: true },
            },
            _count: { select: { chapters: true } },
          },
        },
      },
    });

    return destination;
  } catch {
    return null;
  }
}

export async function getFeaturedDestinations(take: number = 6) {
  try {
    return prisma.destination.findMany({
      where: { featured: true, published: true },
      take,
      orderBy: { name: "asc" },
      include: {
        heroMedia: {
          select: { url: true, altText: true },
        },
      },
    });
  } catch {
    return [];
  }
}

export async function getPublicDestinationSlugs() {
  try {
    return prisma.destination.findMany({
      where: { published: true },
      select: {
        slug: true,
        updatedAt: true,
      },
    });
  } catch {
    return [];
  }
}

export async function getPublicDestinations() {
  try {
    return prisma.destination.findMany({
      where: { published: true },
      orderBy: { name: "asc" },
      include: {
        heroMedia: {
          select: { url: true, altText: true },
        },
      },
    });
  } catch {
    return [];
  }
}

const HERO_MEDIA_SELECT = {
  url: true,
  altText: true,
  sourceUrl: true,
  sourceAuthor: true,
  licenseName: true,
  licenseUrl: true,
} as const;

export async function getPublicDestinationDirectory() {
  try {
    return prisma.destination.findMany({
      where: { published: true },
      orderBy: { country: "asc" },
      include: { heroMedia: { select: HERO_MEDIA_SELECT } },
    });
  } catch {
    return [];
  }
}

export async function getPublicDestinationsByContinent(continent: string) {
  try {
    return prisma.destination.findMany({
      where: { published: true, continent },
      orderBy: { country: "asc" },
      include: { heroMedia: { select: HERO_MEDIA_SELECT } },
    });
  } catch {
    return [];
  }
}

export async function getPublicContinents() {
  try {
    const grouped = await prisma.destination.groupBy({
      by: ["continent"],
      where: { published: true, continent: { not: null } },
      _count: { _all: true },
    });

    return grouped
      .filter((group) => group.continent !== null)
      .map((group) => ({
        continent: group.continent as string,
        count: group._count._all,
      }));
  } catch {
    return [];
  }
}