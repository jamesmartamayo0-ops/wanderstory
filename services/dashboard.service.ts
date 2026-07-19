import prisma from "@/lib/prisma";
import { JourneyStatus } from "@/app/generated/prisma/enums";
import type { JourneyStatusValue } from "@/lib/journey-transitions";

export type DashboardStats = {
  totalJourneys: number;
  journeyCounts: Record<JourneyStatusValue, number>;
  totalClients: number;
  totalDestinations: number;
  publishedDestinations: number;
  draftDestinations: number;
  totalMedia: number;
  recentJourneys: Array<{
    id: string;
    title: string;
    status: JourneyStatusValue;
    updatedAt: Date;
  }>;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    journeyGroups,
    totalClients,
    totalDestinations,
    publishedDestinations,
    totalMedia,
    recentJourneys,
  ] = await Promise.all([
    prisma.journey.groupBy({ by: ["status"], _count: true }),
    prisma.client.count(),
    prisma.destination.count(),
    prisma.destination.count({ where: { published: true } }),
    prisma.media.count(),
    prisma.journey.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, updatedAt: true },
    }),
  ]);

  const defaultCounts: Record<JourneyStatusValue, number> = {
    DRAFT: 0,
    REVIEW: 0,
    APPROVED: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
  };

  const totalJourneys = journeyGroups.reduce((sum, g) => sum + g._count, 0);
  const journeyCounts: Record<JourneyStatusValue, number> = {
    ...defaultCounts,
  };
  for (const g of journeyGroups) {
    journeyCounts[g.status as JourneyStatusValue] = g._count;
  }
  const draftDestinations = totalDestinations - publishedDestinations;

  return {
    totalJourneys,
    journeyCounts,
    totalClients,
    totalDestinations,
    publishedDestinations,
    draftDestinations,
    totalMedia,
    recentJourneys,
  };
}
