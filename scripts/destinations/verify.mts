// USAGE: `npm run destinations:verify`
// Track A destination verification — proves every manifest entry is fully
// ingested, with the SAME requirements the full 195-country directory will
// face (Track B only adds manifest entries; verification never weakens).
//
// Verified per manifest entry:
//   - destination row exists, published, no duplicate slugs/countries
//   - continent matches manifest and is a valid continent slug
//   - featuredPlace present and matching manifest (REQUIRED)
//   - region matching manifest (nullable when intentionally curated)
//   - description present and matching manifest
//   - hero Media linked; provider = CLOUDINARY; providerId present
//   - HTTPS Cloudinary media URL
//   - alt text present and matching manifest
//   - sourceUrl present and matching manifest
//   - licenseName present and matching manifest
//   - attribution-required licenses (CC BY / CC BY-SA / CC BY-ND / CC BY-NC):
//       sourceAuthor present and matching manifest
//       licenseUrl present and matching manifest
//   - permissive licenses (CC0 / public domain):
//       sourceAuthor / licenseUrl optional (checked when present)
//
// Writes scripts/destinations/verify-result.json. Exit code 1 on any failure.
// Development-local only — guarded by assertReadOnlyScriptSafe().
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { assertReadOnlyScriptSafe } from "../b2-guard.mts";
import {
  DESTINATION_MANIFEST,
  type DestinationManifestEntry,
} from "../../data/destinations/manifest";
import { CONTINENT_SLUGS } from "../../data/continents";
import { licenseRequiresAttribution } from "../../lib/attribution";

assertReadOnlyScriptSafe("destinations/verify.mts");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

let failures = 0;
function check(name: string, cond: boolean, detail: string) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : " :: " + detail}`);
  if (!cond) failures += 1;
}

function mediaIdFor(slug: string): string {
  return `manifest-dest-hero-${slug}`;
}

async function verifyEntry(entry: DestinationManifestEntry): Promise<void> {
  console.log(`\n[${entry.country}] (${entry.slug})`);

  const destination = await prisma.destination.findUnique({
    where: { slug: entry.slug },
    include: { heroMedia: true },
  });

  check("destination row exists", destination !== null, "no row for slug");
  if (!destination) return;

  check(
    "destination is published",
    destination.published === true,
    `published=${destination.published}`
  );
  check(
    "destination name is the country",
    destination.name === entry.country,
    `name=${destination.name}`
  );
  check(
    "continent matches manifest",
    destination.continent === entry.continent,
    `continent=${destination.continent ?? "null"}`
  );
  check(
    "continent is a valid continent slug",
    destination.continent !== null &&
      (CONTINENT_SLUGS as readonly string[]).includes(destination.continent),
    `continent=${destination.continent ?? "null"}`
  );
  check(
    "featuredPlace is present and matches manifest",
    destination.featuredPlace !== null &&
      destination.featuredPlace !== "" &&
      destination.featuredPlace === entry.featuredPlace,
    `featuredPlace=${destination.featuredPlace ?? "null"}`
  );
  check(
    "region matches manifest (nullable when curated)",
    destination.region === entry.region,
    `region=${destination.region ?? "null"}`
  );
  check(
    "description is present and matches manifest",
    destination.description !== null &&
      destination.description !== "" &&
      destination.description === entry.description,
    "description missing or mismatched"
  );
  check(
    "hero media is linked",
    destination.heroMedia !== null &&
      destination.heroMediaId === mediaIdFor(entry.slug),
    `heroMediaId=${destination.heroMediaId ?? "null"}`
  );

  const media = destination.heroMedia;
  if (!media) return;

  check(
    "hero provider is Cloudinary",
    media.provider === "CLOUDINARY",
    `provider=${media.provider}`
  );
  check(
    "hero providerId is present",
    media.providerId !== null && media.providerId !== "",
    "providerId missing"
  );
  check(
    "hero URL is an HTTPS Cloudinary URL",
    media.url.startsWith("https://res.cloudinary.com/"),
    `url=${media.url.slice(0, 64)}`
  );
  check(
    "hero alt text is present and matches manifest",
    media.altText !== null && media.altText !== "" && media.altText === entry.alt,
    `altText=${media.altText ?? "null"}`
  );
  check(
    "sourceUrl is present and matches manifest",
    media.sourceUrl !== null &&
      media.sourceUrl !== "" &&
      media.sourceUrl === entry.imageUrl,
    "sourceUrl missing or mismatched"
  );
  check(
    "licenseName is present and matches manifest",
    media.licenseName !== null &&
      media.licenseName !== "" &&
      media.licenseName === entry.licenseName,
    "licenseName missing or mismatched"
  );

  const requires = licenseRequiresAttribution(media.licenseName ?? "");
  check(
    "license attribution classification is consistent",
    requires === licenseRequiresAttribution(entry.licenseName),
    "classification mismatch"
  );

  if (requires) {
    check(
      "sourceAuthor is present and matches manifest (attribution required)",
      media.sourceAuthor !== null &&
        media.sourceAuthor !== "" &&
        media.sourceAuthor === entry.sourceAuthor,
      `sourceAuthor=${media.sourceAuthor ?? "null"}`
    );
    check(
      "licenseUrl is present and matches manifest (attribution required)",
      media.licenseUrl !== null &&
        media.licenseUrl !== "" &&
        media.licenseUrl === entry.licenseUrl,
      `licenseUrl=${media.licenseUrl ?? "null"}`
    );
  } else {
    check(
      "sourceAuthor matches manifest when present (permissive license)",
      media.sourceAuthor === null || media.sourceAuthor === entry.sourceAuthor,
      `sourceAuthor=${media.sourceAuthor ?? "null"}`
    );
    check(
      "licenseUrl matches manifest when present (permissive license)",
      media.licenseUrl === null || media.licenseUrl === entry.licenseUrl,
      `licenseUrl=${media.licenseUrl ?? "null"}`
    );
  }
}

async function main() {
  console.log(`Verifying ${DESTINATION_MANIFEST.length} manifest entries...`);

  const slugs = new Set<string>();
  const countries = new Set<string>();
  for (const entry of DESTINATION_MANIFEST) {
    if (slugs.has(entry.slug)) {
      check("no duplicate country slugs", false, `duplicate slug ${entry.slug}`);
    }
    slugs.add(entry.slug);

    if (countries.has(entry.country)) {
      check("no duplicate countries", false, `duplicate country ${entry.country}`);
    }
    countries.add(entry.country);

    if (!(CONTINENT_SLUGS as readonly string[]).includes(entry.continent)) {
      check("manifest continent is valid", false, `continent=${entry.continent}`);
    }
  }
  if (slugs.size === DESTINATION_MANIFEST.length) {
    check("manifest has unique slugs", true, `${slugs.size} unique`);
  }

  for (const entry of DESTINATION_MANIFEST) {
    await verifyEntry(entry);
  }

  console.log("");
  console.log(`Verification complete: ${DESTINATION_MANIFEST.length} countries, ${failures} failure(s).`);

  writeFileSync(
    "scripts/destinations/verify-result.json",
    JSON.stringify(
      {
        stage: "track-a",
        countries: DESTINATION_MANIFEST.length,
        checks: "full-strength (see verify.mts)",
        failures,
        ranAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  process.exit(failures > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error("Verification failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });