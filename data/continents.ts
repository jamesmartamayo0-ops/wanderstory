export const CONTINENTS = [
  {
    slug: "asia",
    name: "Asia",
    tagline: "From sacred peaks to emerald bays",
  },
  {
    slug: "europe",
    name: "Europe",
    tagline: "Cliffside villages and alpine silhouettes",
  },
  {
    slug: "north-america",
    name: "North America",
    tagline: "National parks carved by ice and river",
  },
  {
    slug: "south-america",
    name: "South America",
    tagline: "Lost cities and otherworldly landscapes",
  },
  {
    slug: "africa",
    name: "Africa",
    tagline: "Golden savannas alive with the wild",
  },
  {
    slug: "oceania",
    name: "Oceania",
    tagline: "Fjords, reefs, and island adventures",
  },
  {
    slug: "antarctica",
    name: "Antarctica",
    tagline: "The last frontier of silence and ice",
  },
] as const;

export type ContinentSlug = (typeof CONTINENTS)[number]["slug"];

export const CONTINENT_SLUGS: readonly ContinentSlug[] = CONTINENTS.map(
  (continent) => continent.slug
);

export function getContinent(slug: string) {
  return CONTINENTS.find((continent) => continent.slug === slug) ?? null;
}
