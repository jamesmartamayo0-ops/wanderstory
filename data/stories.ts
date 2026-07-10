export interface StoryItem {
  id: string;
  title: string;
  author: string;
  location: string;
  excerpt: string;
  imageSrc: string;
  imageAlt: string;
}

export const stories: StoryItem[] = [
  {
    id: "lost-in-the-highlands",
    title: "Getting Lost in the Highlands",
    author: "Elena Marchetti",
    location: "Scottish Highlands",
    excerpt:
      "I followed a dirt path that wasn't on any map. Three hours later, I found a bothy with a peat fire and a stranger who poured me whisky. That's when I stopped planning and started wandering.",
    imageSrc: "/destinations/placeholder-3.svg",
    imageAlt: "Abstract geometric gradient representing misty highlands",
  },
  {
    id: "desert-nights",
    title: "Desert Nights, Endless Stories",
    author: "Amir Khoury",
    location: "Morocco",
    excerpt:
      "The Sahara at night is quieter than anywhere I've ever been — until the Berbers start drumming. Under that canopy of stars, every stranger becomes a friend.",
    imageSrc: "/destinations/placeholder-2.svg",
    imageAlt: "Abstract geometric gradient representing desert landscape",
  },
  {
    id: "coastal-wander",
    title: "Wandering the Amalfi Steps",
    author: "Sarah Chen",
    location: "Amalfi Coast",
    excerpt:
      "Three hundred steps down to a beach only locals knew. The water was cold, the lemons were warm, and for one afternoon I forgot my phone existed.",
    imageSrc: "/destinations/placeholder-5.svg",
    imageAlt: "Abstract geometric gradient representing a coastal village",
  },
  {
    id: "northern-light-chase",
    title: "Chasing the Green Lady",
    author: "Lars Andersen",
    location: "Norway",
    excerpt:
      "Six nights of cloud cover, then she appeared — a curtain of emerald light dancing across the Arctic sky. I stood in the snow and wept. Some sights demand a reaction.",
    imageSrc: "/destinations/placeholder-4.svg",
    imageAlt: "Abstract geometric gradient representing northern lights",
  },
];
