import { revalidatePath } from "next/cache";

type PublicJourneyPaths = {
  journeySlug?: string;
  destinationSlug?: string;
};

export function revalidateJourneyPaths(
  journeyId: string,
  publicPaths?: PublicJourneyPaths
) {
  revalidatePath("/admin/journeys");
  revalidatePath(`/admin/journeys/${journeyId}`);
  revalidatePath("/journeys");

  if (publicPaths?.journeySlug) {
    revalidatePath(`/journeys/${publicPaths.journeySlug}`);
  } else {
    revalidatePath("/journeys/[slug]", "page");
  }

  if (publicPaths?.destinationSlug) {
    revalidatePath(`/destinations/${publicPaths.destinationSlug}`);
  }
}
