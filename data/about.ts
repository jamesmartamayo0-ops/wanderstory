export interface AboutValue {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface AboutData {
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  missionTitle: string;
  missionDescription: string;
  values: AboutValue[];
}

export const aboutData: AboutData = {
  heroTitle: "About WanderStory",
  heroSubtitle: "Every Journey Tells A Story",
  heroDescription:
    "We believe the best travel stories aren't found in guidebooks. They're carved by curiosity, shaped by detours, and shared by the people who live them.",
  missionTitle: "Our Mission",
  missionDescription:
    "To bridge the gap between wanderlust and real-world adventure by curating honest, experience-driven routes that connect travellers with the soul of a place — not just its landmarks.",
  values: [
    {
      id: "authenticity",
      title: "Authenticity",
      description:
        "Every destination is vetted through real traveller stories, not sponsored listings. What you read is what you'll find.",
      icon: "Compass",
    },
    {
      id: "community",
      title: "Community",
      description:
        "A growing network of storytellers, local guides, and fellow wanderers who share insights that no algorithm can replicate.",
      icon: "Users",
    },
    {
      id: "sustainability",
      title: "Sustainable Travel",
      description:
        "We champion slow travel, local economies, and routes that respect the landscapes and cultures they touch.",
      icon: "Leaf",
    },
  ],
};
