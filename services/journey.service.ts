import prisma from "../lib/prisma";
import { JourneyStatus } from "../app/generated/prisma/enums";
import type {
  CreateJourneyInput,
  UpdateJourneyInput,
} from "../lib/validation/journey.schema";
import type { ActionResult } from "../types";

type JourneyStatusValue = (typeof JourneyStatus)[keyof typeof JourneyStatus];

const allowedTransitions: Record<JourneyStatusValue, JourneyStatusValue[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["DRAFT", "APPROVED"],
  APPROVED: ["PUBLISHED"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.journey.findUnique({
      where: { slug },
    });

    if (!existing || (excludeId && existing.id === excludeId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

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
    },
  });
}

export async function createJourney(
  data: CreateJourneyInput & { authorId: string }
): Promise<ActionResult> {
  try {
    const baseSlug = generateSlug(data.title);
    const slug = await ensureUniqueSlug(baseSlug);

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
      updateData.slug = await ensureUniqueSlug(baseSlug, id);
    }

    if (data.categoryIds !== undefined) {
      await prisma.journeyCategory.deleteMany({ where: { journeyId: id } });

      if (data.categoryIds.length > 0) {
        await prisma.journeyCategory.createMany({
          data: data.categoryIds.map((categoryId) => ({
            journeyId: id,
            categoryId,
          })),
        });
      }
    }

    const { categoryIds, ...restData } = updateData as Record<string, unknown>;

    // convert empty string media IDs to null for Prisma
    if (restData.coverMediaId === "") restData.coverMediaId = null;
    if (restData.ogImageId === "") restData.ogImageId = null;

    const journey = await prisma.journey.update({
      where: { id },
      data: restData,
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
      select: { id: true, status: true, publishedAt: true },
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