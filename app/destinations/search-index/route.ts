import { NextResponse } from "next/server";
import { getPublicDestinationDirectory } from "@/services/destination.service";

export const revalidate = 3600;

export async function GET() {
  const destinations = await getPublicDestinationDirectory();

  return NextResponse.json({
    destinations: destinations.map((destination) => ({
      name: destination.name,
      slug: destination.slug,
      continent: destination.continent,
      featuredPlace: destination.featuredPlace,
    })),
  });
}