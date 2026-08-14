import type { ContinentSlug } from "../continents";

/**
 * Destination Directory manifest (Track A — 10-country sample).
 *
 * One entry per country. Expanding to the full 195-country directory
 * (Track B) is an append-only content operation: add entries to
 * DESTINATION_MANIFEST, then re-run `npm run destinations:ingest` and
 * `npm run destinations:verify`. No application architecture changes.
 *
 * Field rules:
 * - featuredPlace is REQUIRED for every destination (travel identity).
 * - region is OPTIONAL and may be null when intentionally curated.
 * - sourceUrl and licenseName are REQUIRED for every image.
 * - sourceAuthor and licenseUrl are REQUIRED when the license requires
 *   attribution (CC BY / CC BY-SA / CC BY-ND / CC BY-NC), optional for
 *   CC0 / public-domain material (provenance still stored when available).
 */
export interface DestinationManifestEntry {
  country: string;
  slug: string;
  continent: ContinentSlug;
  featuredPlace: string;
  region: string | null;
  description: string;
  alt: string;
  imageUrl: string;
  sourcePageUrl: string;
  sourceAuthor: string;
  licenseName: string;
  licenseUrl: string | null;
}

const COMMONS_FILE_PATH = "https://commons.wikimedia.org/wiki/Special:FilePath/";
const COMMONS_FILE_PAGE = "https://commons.wikimedia.org/wiki/File:";

function commonsImage(fileTitle: string): string {
  return `${COMMONS_FILE_PATH}${encodeURIComponent(fileTitle.replace(/ /g, "_"))}?width=2400`;
}

function commonsFilePage(fileTitle: string): string {
  return `${COMMONS_FILE_PAGE}${fileTitle.replace(/ /g, "_")}`;
}

export const DESTINATION_MANIFEST: DestinationManifestEntry[] = [
  {
    country: "Japan",
    slug: "japan",
    continent: "asia",
    featuredPlace: "Mount Fuji",
    region: "Chūbu Region",
    description:
      "Rise before dawn and watch the first light spill over Mount Fuji's perfect snow-capped cone, mirrored in the still water of Lake Motosu — Japan's most iconic view, worth every early morning.",
    alt: "Mount Fuji mirrored in the still water of Lake Motosu at sunrise",
    imageUrl: commonsImage("Mount Fuji from Lake Motosu.jpg"),
    sourcePageUrl: commonsFilePage("Mount Fuji from Lake Motosu.jpg"),
    sourceAuthor: "Alpsdake",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  {
    country: "Vietnam",
    slug: "vietnam",
    continent: "asia",
    featuredPlace: "Ha Long Bay",
    region: "Quảng Ninh Province",
    description:
      "Drift through Ha Long Bay's emerald waters where thousands of limestone karsts rise from the sea, cloaked in mist and legend.",
    alt: "Limestone karsts rising from the emerald waters of Ha Long Bay",
    imageUrl: commonsImage("Ha Long Bay.jpg"),
    sourcePageUrl: commonsFilePage("Ha Long Bay.jpg"),
    sourceAuthor: "Ondřej Žváček",
    licenseName: "CC BY 2.5",
    licenseUrl: "https://creativecommons.org/licenses/by/2.5/",
  },
  {
    country: "Italy",
    slug: "italy",
    continent: "europe",
    featuredPlace: "Amalfi Coast",
    region: "Campania",
    description:
      "Follow hairpin roads above the Tyrrhenian Sea through pastel villages clinging to cliffs — lemon groves, terracotta rooftops, and sun-soaked piazzas at every turn.",
    alt: "Pastel villages on the cliffs of the Amalfi Coast above the Tyrrhenian Sea",
    imageUrl: commonsImage("Costiera amalfitana.jpg"),
    sourcePageUrl: commonsFilePage("Costiera amalfitana.jpg"),
    sourceAuthor: "Franco il Maestro",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  {
    country: "Switzerland",
    slug: "switzerland",
    continent: "europe",
    featuredPlace: "Matterhorn",
    region: "Valais",
    description:
      "Stand at Riffelsee and watch the Matterhorn's pyramid peak mirror itself in the alpine lake — a silhouette that defines Switzerland.",
    alt: "The Matterhorn's pyramid peak mirrored in Riffelsee",
    imageUrl: commonsImage("Matterhorn Riffelsee 2005-06-11.jpg"),
    sourcePageUrl: commonsFilePage("Matterhorn Riffelsee 2005-06-11.jpg"),
    sourceAuthor: "Dirk Beyer",
    licenseName: "CC BY-SA 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by-sa/3.0/",
  },
  {
    country: "Canada",
    slug: "canada",
    continent: "north-america",
    featuredPlace: "Moraine Lake",
    region: "Alberta",
    description:
      "Paddle the impossibly blue waters of Moraine Lake beneath the Valley of the Ten Peaks, a stone's throw from Banff's pine forests and wildlife.",
    alt: "Turquoise Moraine Lake beneath the Valley of the Ten Peaks in Banff National Park",
    imageUrl: commonsImage("Moraine Lake, Banff National Park.jpg"),
    sourcePageUrl: commonsFilePage("Moraine Lake, Banff National Park.jpg"),
    sourceAuthor: "Brett Hamm",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  {
    country: "United States",
    slug: "united-states",
    continent: "north-america",
    featuredPlace: "Grand Canyon",
    region: "Arizona",
    description:
      "Watch the light move across the Grand Canyon's layered red walls at sunset — two billion years of earth history carved in stone.",
    alt: "The layered red walls of the Grand Canyon at golden hour",
    imageUrl: commonsImage("Grand Canyon National Park.jpg"),
    sourcePageUrl: commonsFilePage("Grand Canyon National Park.jpg"),
    sourceAuthor: "Clément Bardot",
    licenseName: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  },
  {
    country: "Peru",
    slug: "peru",
    continent: "south-america",
    featuredPlace: "Machu Picchu",
    region: "Cusco Region",
    description:
      "Stand on the Sun Gate above Machu Picchu as the citadel emerges from the morning mist — the lost city of the Incas, perched between green peaks and sky.",
    alt: "The Inca citadel of Machu Picchu emerging from morning mist",
    imageUrl: commonsImage("80 - Machu Picchu - Juin 2009 - edit.2.jpg"),
    sourcePageUrl: commonsFilePage("80 - Machu Picchu - Juin 2009 - edit.2.jpg"),
    sourceAuthor: "Martin St-Amant (S23678)",
    licenseName: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  {
    country: "Brazil",
    slug: "brazil",
    continent: "south-america",
    featuredPlace: "Lençóis Maranhenses",
    region: null,
    description:
      "Walk white-sand dunes as far as the eye can see, past lagoons of crystal-clear rainwater — an otherworldly desert of turquoise pools.",
    alt: "White sand dunes of Lençóis Maranhenses dotted with turquoise rain lagoons",
    imageUrl: commonsImage("Lençois Maranhenses.jpg"),
    sourcePageUrl: commonsFilePage("Lençois Maranhenses.jpg"),
    sourceAuthor: "Grecia Alejandra Gomez Iriarte",
    licenseName: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  {
    country: "Kenya",
    slug: "kenya",
    continent: "africa",
    featuredPlace: "Maasai Mara",
    region: "Narok County",
    description:
      "Watch lions and wildebeest roam the golden savanna of the Maasai Mara, where the Great Migration thunders across the plains.",
    alt: "Golden savanna of the Maasai Mara National Reserve at dusk",
    imageUrl: commonsImage("Maasai Mara National Reserve.jpg"),
    sourcePageUrl: commonsFilePage("Maasai Mara National Reserve.jpg"),
    sourceAuthor: "Ninara",
    licenseName: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  },
  {
    country: "New Zealand",
    slug: "new-zealand",
    continent: "oceania",
    featuredPlace: "Milford Sound",
    region: "Fiordland",
    description:
      "Cruise through Milford Sound's sheer cliffs and waterfalls in the heart of Fiordland — rain or shine, one of the world's most dramatic fjords.",
    alt: "Sheer cliffs and waterfalls of Milford Sound in Fiordland",
    imageUrl: commonsImage("Milford Sound 02.jpg"),
    sourcePageUrl: commonsFilePage("Milford Sound 02.jpg"),
    sourceAuthor: "User: (WT-shared) Plug at wts wikivoyage",
    licenseName: "Public domain",
    licenseUrl: null,
  },
];

export function getManifestDestination(slug: string) {
  return DESTINATION_MANIFEST.find((entry) => entry.slug === slug) ?? null;
}
