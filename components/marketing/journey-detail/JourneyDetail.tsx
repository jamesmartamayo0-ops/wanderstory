import type { PublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";
import HeroSection from "./HeroSection";
import IntroductionBlock from "./IntroductionBlock";
import TimelineBlock from "./TimelineBlock";
import ChapterBlock from "./ChapterBlock";
import QuoteBlock from "./QuoteBlock";
import GalleryBlock from "./GalleryBlock";
import JourneyShare from "./JourneyShare";
import {
  getJourneyDescription,
  getJourneySocialTitle,
} from "@/lib/social-sharing";

interface JourneyDetailProps {
  journey: PublicJourneyDetail;
  slug: string;
  publicJourneyUrl: string;
}

export default function JourneyDetail({
  journey,
  slug,
  publicJourneyUrl,
}: JourneyDetailProps) {
  return (
    <>
      <HeroSection journey={journey} slug={slug} />
      <JourneyShare
        title={getJourneySocialTitle(journey)}
        text={getJourneyDescription(journey)}
        url={publicJourneyUrl}
      />
      <IntroductionBlock introduction={journey.introduction} />
      <TimelineBlock timelineEvents={journey.timelineEvents} />
      <ChapterBlock chapters={journey.chapters} />
      <QuoteBlock quotes={journey.quotes} />
      <GalleryBlock gallery={journey.gallery} />
    </>
  );
}
