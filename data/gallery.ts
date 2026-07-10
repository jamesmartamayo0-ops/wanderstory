export interface GalleryItem {
  id: string;
  title: string;
  location: string;
  imageSrc: string;
  imageAlt: string;
}

export const galleryItems: GalleryItem[] = [
  {
    id: "coastal-mist",
    title: "Coastal Mist",
    location: "Pacific Northwest",
    imageSrc: "/destinations/placeholder-1.svg",
    imageAlt: "Abstract geometric gradient representing a misty coastline",
  },
  {
    id: "desert-glow",
    title: "Desert Glow",
    location: "Southwest",
    imageSrc: "/destinations/placeholder-2.svg",
    imageAlt: "Abstract geometric gradient representing a desert sunset",
  },
  {
    id: "highland-veil",
    title: "Highland Veil",
    location: "Scottish Highlands",
    imageSrc: "/destinations/placeholder-3.svg",
    imageAlt: "Abstract geometric gradient representing misty highlands",
  },
  {
    id: "polar-sky",
    title: "Polar Sky",
    location: "Scandinavia",
    imageSrc: "/destinations/placeholder-4.svg",
    imageAlt: "Abstract geometric gradient representing northern lights",
  },
  {
    id: "mediterranean-haze",
    title: "Mediterranean Haze",
    location: "Amalfi Coast",
    imageSrc: "/destinations/placeholder-5.svg",
    imageAlt: "Abstract geometric gradient representing a coastal village",
  },
  {
    id: "alpine-silence",
    title: "Alpine Silence",
    location: "Swiss Alps",
    imageSrc: "/destinations/placeholder-6.svg",
    imageAlt: "Abstract geometric gradient representing alpine peaks",
  },
];
