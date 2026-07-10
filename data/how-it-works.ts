export interface HowItWorksStep {
  id: string;
  stepNumber: string;
  icon: string;
  title: string;
  description: string;
}

export const howItWorksSteps: HowItWorksStep[] = [
  {
    id: "discover",
    stepNumber: "01",
    icon: "Compass",
    title: "Discover",
    description:
      "Explore handpicked destinations crafted from real traveller stories and local insights.",
  },
  {
    id: "plan",
    stepNumber: "02",
    icon: "Map",
    title: "Plan",
    description:
      "Build your perfect itinerary with curated routes, hidden gems, and honest recommendations.",
  },
  {
    id: "experience",
    stepNumber: "03",
    icon: "Mountain",
    title: "Experience",
    description:
      "Step into the story — wander beyond the guidebook and create memories that last a lifetime.",
  },
];
