import type { PublicDestinationDetail } from "@/lib/adapters/destination-detail.adapter";
import HeroSection from "./HeroSection";
import DescriptionBlock from "./DescriptionBlock";
import RelatedJourneysBlock from "./RelatedJourneysBlock";

interface DestinationDetailProps {
  destination: PublicDestinationDetail;
}

export default function DestinationDetail({
  destination,
}: DestinationDetailProps) {
  return (
    <>
      <HeroSection destination={destination} />
      <DescriptionBlock description={destination.description} />
      <RelatedJourneysBlock journeys={destination.relatedJourneys} />
    </>
  );
}
