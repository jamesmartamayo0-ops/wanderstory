import type { PublicJourneyDetail } from "@/lib/adapters/journey-detail.adapter";
import HeroSection from "./HeroSection";
import IntroductionBlock from "./IntroductionBlock";
import TimelineBlock from "./TimelineBlock";
import ChapterBlock from "./ChapterBlock";
import QuoteBlock from "./QuoteBlock";
import GalleryBlock from "./GalleryBlock";

interface JourneyDetailProps {
  journey: PublicJourneyDetail;
}

export default function JourneyDetail({ journey }: JourneyDetailProps) {
  return (
    <>
      <HeroSection journey={journey} />
      <IntroductionBlock introduction={journey.introduction} />
      <TimelineBlock timelineEvents={journey.timelineEvents} />
      <ChapterBlock chapters={journey.chapters} />
      <QuoteBlock quotes={journey.quotes} />
      <GalleryBlock gallery={journey.gallery} />
    </>
  );
}
