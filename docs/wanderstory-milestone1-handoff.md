# WanderStory — Milestone 1 Handoff (Database Foundation)

**Purpose of this document:** continuation context for a new AI session (or engineer) picking up this project. Treat everything below as already-verified fact, not open for redesign.

---

## Do NOT

- Restart architecture planning
- Redesign the database
- Change the approved stack
- Invent models, rename fields, or remove relations
- Migrate before `DATABASE_URL` / PostgreSQL availability are confirmed

---

## Project

- **Name:** WanderStory — premium editorial travel storytelling platform (public site + private single-admin CMS)
- **Location (local):** `C:\Dev\Projects\wanderstory`
- **Stack:** Next.js 15.5.20 (App Router, TypeScript, Tailwind), Prisma ORM 7.8.0, PostgreSQL, Cloudinary (later milestone), Auth.js (later milestone)
- **Source of truth architecture doc:** `docs/wanderstory-architecture-SecondUpdate.md` (v1.2). Older files in `docs/` (`wanderstory-architecture.md`, `wanderstory-architecture-UPDATE.md`) are historical only — do not reference them.
- **No separate backend** — Route Handlers under `app/api/` + Server Components querying Prisma directly. Services-only data access pattern (Milestone 2+).

---

## Milestone 0 — Project Scaffold: COMPLETE ✅

- Next.js 15.5.20 pinned (scaffold defaults to 16; downgraded intentionally), TypeScript, Tailwind, ESLint, App Router
- Prettier + `eslint-config-prettier` (no lint/format conflicts)
- Folder architecture per architecture doc §8: `app/(public)`, `app/admin`, `app/api`, `components/{ui,layout}`, `features/`, `lib/validation`, `services/`, `hooks/`, `types/`, `prisma/`, `styles/`
- `.env.example` created, no secrets committed, `.env*` gitignored
- Verified: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run dev` — all pass

---

## Architecture Verification: COMPLETE ✅

Extracted directly from `wanderstory-architecture-SecondUpdate.md` (727 lines) and diffed against six locked corrections.

**11 Prisma models:** Admin, Client, PublicationConsent, Journey, Chapter, TimelineEvent, Quote, Destination, Category, JourneyCategory (join table), Media

**5 enums:**
- `AdminRole`: SUPER_ADMIN, EDITOR
- `JourneyStatus`: DRAFT, REVIEW, APPROVED, PUBLISHED, ARCHIVED
- `JourneyVisibility`: PUBLIC, PRIVATE
- `MediaType`: IMAGE, VIDEO
- `MediaRole`: COVER, GALLERY, CHAPTER, DESTINATION_HERO, OG_IMAGE

**Six locked corrections — all confirmed:**

| # | Requirement | Status |
|---|---|---|
| 1 | `Client.email` optional | ✅ `email String?` |
| 2 | `Journey.privateToken` exists, separate from `slug`, nullable (generated only when `visibility = PRIVATE`) | ✅ `privateToken String? @unique` — nullability is intentional, not a bug |
| 3 | `JourneyStatus`: DRAFT/REVIEW/APPROVED/PUBLISHED/ARCHIVED | ✅ exact match |
| 4 | Publishing transition `APPROVED → PUBLISHED` only | ✅ Confirmed as the correct rule. One sentence in §4 of the architecture doc ("Publish is a single state transition, `DRAFT → PUBLISHED`") is a **documentation leftover** from before the pipeline was expanded in v1.1 — it does not override the diagram above it or this locked correction. Not a schema concern either way — Prisma doesn't encode transition rules; this belongs in service-layer logic in a later milestone. |
| 5 | `@@unique([journeyId, order])` on Chapter, TimelineEvent, Quote | ✅ all three present |
| 6 | Argon2id only, no bcrypt, no signup, seeded Admin only | ✅ confirmed in §7 |

---

## Milestone 1 — Database Foundation: IN PROGRESS

### Packages installed
```powershell
npm install @prisma/client argon2
npm install -D prisma tsx
npm install @prisma/adapter-pg pg dotenv
npm install -D @types/pg
```
All six flagged native/install-script packages (`@prisma/engines`, `argon2`, `esbuild`, `prisma`, `sharp`, `unrs-resolver`) were approved via:
```powershell
npm approve-scripts @prisma/engines argon2 esbuild prisma sharp unrs-resolver
npm install
```

### Prisma version note
Installed: **Prisma 7.8.0** — not Prisma 5/6. Key differences applied throughout:
- `datasource.url` no longer allowed inside `schema.prisma` (errors with `P1012` if left in)
- Connection URL, migrations path, and seed command now live in `prisma.config.ts`
- `new PrismaClient()` requires a driver adapter (`@prisma/adapter-pg` for Postgres) — bare instantiation throws
- Generated client is imported from a custom `output` path, not `@prisma/client` directly

### Files created (contents below — this is what passed validation)

#### `prisma/schema.prisma`
All 11 models / 5 enums preserved verbatim from architecture doc §3. Only the top `generator`/`datasource` block was adapted for Prisma 7.

```prisma
// schema.prisma

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum AdminRole {
  SUPER_ADMIN // reserved for future multi-editor support — unused in Phase 1
  EDITOR
}

enum JourneyStatus {
  DRAFT      // admin actively writing/organizing
  REVIEW     // ready for admin's own editorial pass (or future: client review)
  APPROVED   // signed off, queued for publish
  PUBLISHED  // live
  ARCHIVED   // pulled from public view, kept for records/re-publish
}

enum JourneyVisibility {
  PUBLIC   // appears in the public collection
  PRIVATE  // accessible only via direct client link
}

enum MediaType {
  IMAGE
  VIDEO
}

enum MediaRole {
  COVER
  GALLERY
  CHAPTER
  DESTINATION_HERO
  OG_IMAGE
}

// ─────────────────────────────────────────────
// CORE MODELS
// ─────────────────────────────────────────────

model Admin {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  role         AdminRole @default(SUPER_ADMIN) // architecture-only field for Phase 1
  journeys     Journey[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

// Admin-managed contact record — never a login account.
// Represents the traveler/couple/family the story is about,
// and who WanderStory is contracting with.
model Client {
  id                  String               @id @default(cuid())
  name                String
  email               String?
  phone               String?
  notes               String?              @db.Text // private admin notes, never rendered publicly
  journeys            Journey[]
  publicationConsents PublicationConsent[]
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
}

// Tracks the client's public/private publishing decision for a journey.
// One record per journey — re-consenting (e.g. client changes their mind)
// updates this record rather than creating history rows in Phase 1.
model PublicationConsent {
  id           String   @id @default(cuid())
  journey      Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId    String   @unique
  client       Client   @relation(fields: [clientId], references: [id])
  clientId     String
  consentGiven Boolean  // true = publish publicly, false = keep private
  consentedAt  DateTime // when the client made this choice
  notes        String?  @db.Text // e.g. "confirmed via email 2026-07-09"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([clientId])
}

model Journey {
  id              String            @id @default(cuid())
  slug            String            @unique
  title           String
  travelerName    String
  travelStartDate DateTime
  travelEndDate   DateTime
  introduction    String            @db.Text

  status       JourneyStatus     @default(DRAFT)
  featured     Boolean           @default(false) // homepage editorial selection
  visibility   JourneyVisibility @default(PRIVATE)
  privateToken String?           @unique // non-guessable token powering the private delivery link; set when visibility=PRIVATE
  publishedAt  DateTime?

  author   Admin  @relation(fields: [authorId], references: [id])
  authorId String

  client   Client @relation(fields: [clientId], references: [id])
  clientId String

  destination   Destination @relation(fields: [destinationId], references: [id])
  destinationId String

  categories         JourneyCategory[]
  chapters           Chapter[]
  timelineEvents     TimelineEvent[]
  quotes             Quote[]
  media              Media[]
  publicationConsent PublicationConsent?

  coverMedia   Media?  @relation("JourneyCover", fields: [coverMediaId], references: [id])
  coverMediaId String? @unique

  // SEO — embedded directly on Journey for Phase 1 simplicity.
  // Extract into a related SeoMeta model in Phase 3 if fields grow.
  seoTitle       String?
  seoDescription String?
  canonicalUrl   String?
  ogImage        Media?  @relation("JourneyOgImage", fields: [ogImageId], references: [id])
  ogImageId      String? @unique
  structuredData Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, visibility])
  @@index([destinationId])
  @@index([clientId])
  @@index([featured])
}

model Chapter {
  id        String   @id @default(cuid())
  journey   Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId String
  title     String
  order     Int
  content   String   @db.Text // Markdown or rich-text JSON
  media     Media[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([journeyId, order])
  @@unique([journeyId, order])
}

model TimelineEvent {
  id          String   @id @default(cuid())
  journey     Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId   String
  date        DateTime
  title       String
  description String?  @db.Text
  order       Int

  @@index([journeyId, order])
  @@unique([journeyId, order])
}

model Quote {
  id          String  @id @default(cuid())
  journey     Journey @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId   String
  text        String  @db.Text
  attribution String?
  order       Int

  @@unique([journeyId, order])
}

model Destination {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  country     String
  region      String?
  description String?   @db.Text
  heroMedia   Media?    @relation(fields: [heroMediaId], references: [id])
  heroMediaId String?   @unique
  journeys    Journey[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Category {
  id          String            @id @default(cuid())
  slug        String            @unique
  name        String
  description String?
  journeys    JourneyCategory[]
}

// Explicit join table (rather than implicit M:N) so we can later
// add fields like "featured" or "order" without a migration surprise.
model JourneyCategory {
  journey    Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId  String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  categoryId String

  @@id([journeyId, categoryId])
}

model Media {
  id           String    @id @default(cuid())
  cloudinaryId String    @unique
  url          String
  thumbnailUrl String
  mediumUrl    String
  largeUrl     String
  webpUrl      String
  blurDataUrl  String?   @db.Text
  width        Int
  height       Int
  format       String
  type         MediaType
  role         MediaRole
  altText      String?
  order        Int       @default(0)

  journey   Journey? @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId String?

  chapter   Chapter? @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  chapterId String?

  journeyCover    Journey?     @relation("JourneyCover")
  journeyOgImage  Journey?     @relation("JourneyOgImage")
  destinationHero Destination?

  createdAt DateTime @default(now())

  @@index([journeyId])
  @@index([chapterId])
}
```

#### `prisma.config.ts`
```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

#### `lib/prisma.ts`
```typescript
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

#### `prisma/seed.ts`
```typescript
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import argon2 from "argon2";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before seeding."
    );
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
  });

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });

  console.log(`Admin created successfully: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Validation results (run locally, confirmed by user)
```
PS C:\Dev\Projects\wanderstory> npx prisma format
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
Formatted prisma\schema.prisma in 10ms 🚀

PS C:\Dev\Projects\wanderstory> npx prisma validate
Loaded Prisma config from prisma.config.ts.
Prisma schema loaded from prisma\schema.prisma.
The schema at prisma\schema.prisma is valid 🚀
```

---

## Current project tree
```
wanderstory/
├── app/
├── docs/
│   ├── wanderstory-architecture.md              (historical)
│   ├── wanderstory-architecture-UPDATE.md        (historical)
│   └── wanderstory-architecture-SecondUpdate.md  (source of truth, v1.2)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── lib/
│   └── prisma.ts
├── public/
├── prisma.config.ts
├── package.json
├── package-lock.json
├── .env
```

---

## Current stop point — NOT YET DONE

- [ ] `npx prisma generate`
- [ ] `npx prisma migrate dev --name init`
- [ ] Database seed (`npx prisma db seed`)
- [ ] Auth.js (Milestone 2)
- [ ] API routes / services layer (Milestone 2–3)
- [ ] Frontend (later milestones)

**Before migrating, confirm:**
1. `DATABASE_URL` in `.env` — pointing at a real, reachable PostgreSQL instance, or still the `prisma init` placeholder?
2. PostgreSQL itself — provisioned and running?
3. `package.json` — confirm `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `pg` are all present as dependencies (they are, per the install log above, but worth a final `npm list` sanity check before migrating)

**Next commands once confirmed:**
```powershell
npx prisma generate
npx prisma migrate dev --name init
```
Stop and report the migration result. Do not seed until that's confirmed working.

---

## Standing rules for whoever continues this

- Treat `docs/wanderstory-architecture-SecondUpdate.md` as the only source of truth
- Do not simplify the schema, rename fields, remove relations, or add models not in the doc
- Do not migrate until `DATABASE_URL` / PostgreSQL are confirmed
- Publishing transition logic (`APPROVED → PUBLISHED` only) belongs in service-layer code in a later milestone — not in Prisma
- Do not create services, API routes, UI, or Auth.js config yet — those are Milestone 2+
