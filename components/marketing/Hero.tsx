import HeroContent from "./HeroContent";

export interface HeroProps {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageSrc?: string;
  imageAlt?: string;
  videoSrc?: string;
}

// TEMP placeholder strategy — Phase 1.2 only.
// imageSrc points to a local file under /public/hero/ for now.
// Phase 3 replaces this default (or passes props directly) with a
// real res.cloudinary.com URL sourced from Prisma — no component
// changes required, since HeroContent only ever consumes a string.
const DEFAULT_HERO: Required<HeroProps> = {
  eyebrow: "WanderStory",
  headline: "Explore Beyond",
  subheadline: "Every Journey Tells A Story",
  description:
    "Handpicked routes and honest storytelling — the kind of detail that turns a trip into a story worth telling twice.",
  ctaLabel: "Start Exploring",
  ctaHref: "/#explore",
  imageSrc: "/hero/placeholder-hero.jpg",
  imageAlt: "Sweeping coastal cliffside at golden hour",
  videoSrc: "/hero/hero-ambient.mp4",
};

export default function Hero(props: HeroProps) {
  const content = { ...DEFAULT_HERO, ...props };
  return <HeroContent {...content} />;
}
