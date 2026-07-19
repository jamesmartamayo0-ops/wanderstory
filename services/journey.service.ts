import prisma from "../lib/prisma";
import { generateSlug, ensureUniqueSlug } from "../lib/slug";
import { allowedTransitions, type JourneyStatusValue } from "../lib/journey-transitions";
import type {
  CreateJourneyInput,
  UpdateJourneyInput,
} from "../lib/validation/journey.schema";
import type { ActionResult } from "../types";

export type JourneyFilters = {
  status?: JourneyStatusValue;
  visibility?: "PUBLIC" | "PRIVATE";
  clientId?: string;
  destinationId?: string;
};

export async function getAllJourneys(filters?: JourneyFilters) {
  return prisma.journey.findMany({
    where: {
      ...(filters?.status && { status: filters.status }),
      ...(filters?.visibility && { visibility: filters.visibility }),
      ...(filters?.clientId && { clientId: filters.clientId }),
      ...(filters?.destinationId && { destinationId: filters.destinationId }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      destination: { select: { id: true, name: true } },
      categories: {
        include: { category: { select: { id: true, name: true } } },
      },
      _count: { select: { chapters: true } },
    },
  });
}

export async function getJourneyById(id: string) {
  return prisma.journey.findUnique({
    where: { id },
    include: {
      client: true,
      destination: true,
      categories: { include: { category: true } },
      chapters: { orderBy: { order: "asc" } },
      timelineEvents: { orderBy: { order: "asc" } },
      quotes: { orderBy: { order: "asc" } },
      media: { orderBy: { order: "asc" } },
      coverMedia: true,
      ogImage: true,
      publicationConsent: true,
    },
  });
}

export async function createJourney(
  data: CreateJourneyInput & { authorId: string }
): Promise<ActionResult> {
  try {
    const baseSlug = generateSlug(data.title);
    const slug = await ensureUniqueSlug(baseSlug, (s) =>
      prisma.journey.findUnique({ where: { slug: s } })
    );

    const { categoryIds, ...journeyData } = data;

    const journey = await prisma.journey.create({
      data: {
        ...journeyData,
        slug,
        categories: categoryIds?.length
          ? {
              create: categoryIds.map((categoryId) => ({ categoryId })),
            }
          : undefined,
      },
    });

    return { success: true, data: journey };
  } catch {
    return { success: false, error: "Failed to create journey" };
  }
}

export async function updateJourney(
  id: string,
  data: UpdateJourneyInput
): Promise<ActionResult> {
  try {
    const updateData: Record<string, unknown> = { ...data };

    if (data.title) {
      const baseSlug = generateSlug(data.title);
      updateData.slug = await ensureUniqueSlug(baseSlug, (s) =>
        prisma.journey.findUnique({ where: { slug: s } }),
        id
      );
    }

    const { categoryIds: _, ...restData } = updateData as Record<string, unknown>;

    // convert empty string media IDs to null for Prisma
    if (restData.coverMediaId === "") restData.coverMediaId = null;
    if (restData.ogImageId === "") restData.ogImageId = null;

    const journey = await prisma.$transaction(async (tx) => {
      if (data.categoryIds !== undefined) {
        await tx.journeyCategory.deleteMany({ where: { journeyId: id } });

        if (data.categoryIds.length > 0) {
          await tx.journeyCategory.createMany({
            data: data.categoryIds.map((categoryId) => ({
              journeyId: id,
              categoryId,
            })),
          });
        }
      }

      return tx.journey.update({
        where: { id },
        data: restData,
      });
    });

    return { success: true, data: journey };
  } catch {
    return { success: false, error: "Failed to update journey" };
  }
}

export async function deleteJourney(id: string): Promise<ActionResult> {
  try {
    await prisma.journey.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete journey" };
  }
}

export async function updateJourneyStatus(
  id: string,
  newStatus: JourneyStatusValue
): Promise<ActionResult> {
  try {
    const journey = await prisma.journey.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        publicationConsent: { select: { consentGiven: true } },
      },
    });

    if (!journey) {
      return { success: false, error: "Journey not found" };
    }

    const allowed = allowedTransitions[journey.status];

    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Cannot transition from ${journey.status} to ${newStatus}`,
      };
    }

    if (
      journey.status === "APPROVED" &&
      newStatus === "PUBLISHED"
    ) {
      if (!journey.publicationConsent?.consentGiven) {
        return {
          success: false,
          error: "Cannot publish without client consent",
        };
      }
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    if (
      journey.status === "APPROVED" &&
      newStatus === "PUBLISHED"
    ) {
      updateData.publishedAt = new Date();
    }

    const updated = await prisma.journey.update({
      where: { id },
      data: updateData,
    });

    return { success: true, data: updated };
  } catch {
    return { success: false, error: "Failed to update journey status" };
  }
}

export async function updatePublicationConsent(
  journeyId: string,
  data: { consentGiven: boolean; clientId: string; notes?: string }
): Promise<ActionResult> {
  try {
    const consent = await prisma.publicationConsent.upsert({
      where: { journeyId },
      update: {
        consentGiven: data.consentGiven,
        clientId: data.clientId,
        consentedAt: new Date(),
        notes: data.notes ?? null,
      },
      create: {
        journeyId,
        consentGiven: data.consentGiven,
        clientId: data.clientId,
        consentedAt: new Date(),
        notes: data.notes ?? null,
      },
    });

    return { success: true, data: consent };
  } catch {
    return { success: false, error: "Failed to update publication consent" };
  }
}

export async function getPublicJourneys() {
  try {
    const journeys = await prisma.journey.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        publicationConsent: { consentGiven: true },
      },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      include: {
        destination: { select: { name: true, country: true } },
        coverMedia: { select: { url: true, altText: true } },
        _count: { select: { chapters: true } },
      },
    });

    return journeys;
  } catch {
    return [];
  }
}

export async function getPublicJourneyBySlug(slug: string) {
  try {
    const journey = await prisma.journey.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        publicationConsent: { consentGiven: true },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        travelerName: true,
        travelStartDate: true,
        travelEndDate: true,
        introduction: true,
        publishedAt: true,
        seoTitle: true,
        seoDescription: true,
        canonicalUrl: true,
        structuredData: true,
        destination: {
          select: { name: true, country: true, slug: true },
        },
        coverMedia: {
          select: {
            url: true,
            altText: true,
            blurDataUrl: true,
            width: true,
            height: true,
          },
        },
        categories: {
          select: {
            category: { select: { name: true, slug: true } },
          },
        },
        chapters: {
          select: {
            id: true,
            title: true,
            order: true,
            content: true,
            media: {
              select: {
                id: true,
                url: true,
                thumbnailUrl: true,
                altText: true,
                width: true,
                height: true,
                blurDataUrl: true,
                role: true,
              },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
        timelineEvents: {
          select: {
            id: true,
            date: true,
            title: true,
            description: true,
            order: true,
          },
          orderBy: { order: "asc" },
        },
        quotes: {
          select: {
            id: true,
            text: true,
            attribution: true,
            order: true,
          },
          orderBy: { order: "asc" },
        },
        media: {
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            altText: true,
            width: true,
            height: true,
            blurDataUrl: true,
            role: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    return journey;
  } catch {
    return null;
  }
}

export async function getPublicJourneySlugs() {
  try {
    const journeys = await prisma.journey.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        publicationConsent: { consentGiven: true },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    });

    return journeys;
  } catch {
    return [];
  }
}

export async function toggleFeatured(id: string): Promise<ActionResult> {
  try {
    const journey = await prisma.journey.findUnique({
      where: { id },
      select: { id: true, featured: true },
    });

    if (!journey) {
      return { success: false, error: "Journey not found" };
    }

    const updated = await prisma.journey.update({
      where: { id },
      data: { featured: !journey.featured },
    });

    return { success: true, data: updated };
  } catch {
    return { success: false, error: "Failed to toggle featured" };
  }
}