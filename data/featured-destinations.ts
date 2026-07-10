export interface FeaturedDestination {
  id: string;
  title: string;
  location: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
}

export const featuredDestinations: FeaturedDestination[] = [
  {
    id: "coastal-cliffs",
    title: "Coastal Cliffs",
    location: "Pacific Northwest",
    description:
      "Rugged shorelines where ancient forests meet the sea — a landscape carved by wind and wave.",
    imageSrc: "/destinations/placeholder-1.svg",
    imageAlt: "Abstract geometric gradient representing coastal cliffs",
  },
  {
    id: "desert-mesas",
    title: "Desert Mesas",
    location: "Southwest",
    description:
      "Towering sandstone sentinels rising from an ocean of rust-coloured dust and juniper.",
    imageSrc: "/destinations/placeholder-2.svg",
    imageAlt: "Abstract geometric gradient representing desert mesas",
  },
  {
    id: "misty-highlands",
    title: "Misty Highlands",
    location: "Scottish Highlands",
    description:
      "Heather-blanketed valleys shrouded in silver mist, where every step uncovers a Celtic legend.",
    imageSrc: "/destinations/placeholder-3.svg",
    imageAlt: "Abstract geometric gradient representing misty highlands",
  },
  {
    id: "northern-lights",
    title: "Northern Lights",
    location: "Scandinavia",
    description:
      "Emerald and violet ribbons dancing across an inky polar sky — nature's own light show.",
    imageSrc: "/destinations/placeholder-4.svg",
    imageAlt: "Abstract geometric gradient representing northern lights",
  },
  {
    id: "sun-kissed-coast",
    title: "Sun-Kissed Coast",
    location: "Amalfi Coast",
    description:
      "Pastel villages clinging to dramatic cliffs above a glittering turquoise Mediterranean sea.",
    imageSrc: "/destinations/placeholder-5.svg",
    imageAlt: "Abstract geometric gradient representing a sun-kissed coast",
  },
  {
    id: "alpine-peaks",
    title: "Alpine Peaks",
    location: "Swiss Alps",
    description:
      "Snow-capped granite spires piercing a crystalline sky above flower-dotted alpine meadows.",
    imageSrc: "/destinations/placeholder-6.svg",
    imageAlt: "Abstract geometric gradient representing alpine peaks",
  },
];
