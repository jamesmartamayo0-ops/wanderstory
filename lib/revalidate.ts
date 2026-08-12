import { revalidatePath } from "next/cache";

export function revalidateJourneyPaths(journeyId: string) {
  revalidatePath("/admin/journeys");
  revalidatePath(`/admin/journeys/${journeyId}`);
  revalidatePath("/journeys");
  revalidatePath("/journeys/[slug]", "page");
}
