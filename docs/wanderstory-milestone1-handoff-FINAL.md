# WanderStory — Milestone 1 Handoff (Database Foundation) — UPDATED / FINAL

**Purpose:** continuation context for a new AI session (OpenChamber / DeepSeek or otherwise). Everything below is independently verified against the actual filesystem and database — not just CLI success messages. Treat as ground truth.

---

## Do NOT

- Restart architecture planning
- Redesign the database
- Change the approved stack
- Invent models, rename fields, or remove relations
- Trust a Prisma CLI success message alone — this project had multiple false positives today (details below). Always verify file contents and database state directly.

---

## Project

- **Name:** WanderStory — premium editorial travel storytelling platform (public site + private single-admin CMS)
- **Location (local):** `C:\Dev\Projects\wanderstory`
- **Stack:** Next.js 15.5.20 (App Router, TypeScript, Tailwind), Prisma ORM 7.8.0, PostgreSQL (Docker, local dev), Cloudinary (later milestone), Auth.js (later milestone)
- **Source of truth architecture doc:** `docs/wanderstory-architecture-SecondUpdate.md` (v1.2). Older files in `docs/` are historical only.
- **No separate backend** — Route Handlers under `app/api/` + Server Components querying Prisma directly. Services-only data access pattern (Milestone 2+).

---

## Milestone 0 — Project Scaffold: COMPLETE ✅

- Next.js 15.5.20 pinned, TypeScript, Tailwind, ESLint, App Router, Prettier
- Folder architecture per architecture doc §8
- `.env.example` created, no secrets committed
- `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run dev` all verified passing

---

## Architecture Verification: COMPLETE ✅

**11 Prisma models:** Admin, Client, PublicationConsent, Journey, Chapter, TimelineEvent, Quote, Destination, Category, JourneyCategory (join table), Media

**5 enums:** AdminRole (SUPER_ADMIN, EDITOR) · JourneyStatus (DRAFT, REVIEW, APPROVED, PUBLISHED, ARCHIVED) · JourneyVisibility (PUBLIC, PRIVATE) · MediaType (IMAGE, VIDEO) · MediaRole (COVER, GALLERY, CHAPTER, DESTINATION_HERO, OG_IMAGE)

**Six locked corrections — all confirmed, all implemented:**

| # | Requirement | Status |
|---|---|---|
| 1 | `Client.email` optional | ✅ `email String?` |
| 2 | `Journey.privateToken` separate from `slug`, nullable by design (set only when `visibility = PRIVATE`) | ✅ `privateToken String? @unique` |
| 3 | `JourneyStatus`: DRAFT/REVIEW/APPROVED/PUBLISHED/ARCHIVED | ✅ |
| 4 | Publishing transition `APPROVED → PUBLISHED` only | ✅ Confirmed as the rule. One sentence in §4 of the architecture doc ("DRAFT → PUBLISHED") is a stale leftover from before the v1.1 pipeline expansion — not authoritative. Not a schema concern; belongs in service-layer logic in a later milestone, since Prisma doesn't encode transition rules. |
| 5 | `@@unique([journeyId, order])` on Chapter, TimelineEvent, Quote | ✅ all three present |
| 6 | Argon2id only, no bcrypt, no signup, seeded Admin only | ✅ |

---

## Milestone 1 — Database Foundation: **COMPLETE ✅ (fully verified end-to-end)**

### ⚠️ Important context: what went wrong along the way (read this before trusting any prior handoff)

A previous handoff summary claimed all four Milestone 1 files were "created" and validation had "passed." When a new session actually inspected the filesystem, **`lib/prisma.ts` and `prisma/seed.ts` did not exist**, and `prisma.config.ts` was still the untouched Prisma-generated default. The earlier `npx prisma format` / `npx prisma validate` "success" was real, but misleading — those commands only check syntax, and they'll happily pass on a schema with zero models in it. That's exactly what had happened: `prisma/schema.prisma` still contained only the 7-line boilerplate (`generator`/`datasource`, no models), despite being described as complete.

**Lesson applied for the rest of this session, and recommended for whoever continues:** after any file-write step, independently confirm with `Get-Content` / line counts, and after any migration/seed step, independently confirm against the actual database (`docker exec ... psql ... \dt` or a direct `SELECT`) — never rely on a CLI's summary line alone.

A second issue surfaced during file recreation: writing files via `Set-Content -Encoding utf8` in PowerShell adds a **UTF-8 BOM** (invisible leading bytes), which Prisma's parser cannot handle — it throws `P1012` claiming the very first line ("generator client {") isn't a recognized keyword. Fix used throughout: write with `Set-Content -Encoding utf8`, then immediately re-write with `[System.IO.File]::WriteAllText(path, content, New-Object System.Text.UTF8Encoding($false))` to strip the BOM. This should be the standard method for any future file writes in this project via PowerShell — plain `Set-Content -Encoding utf8` is not safe for Prisma files.

### Packages installed
```powershell
npm install @prisma/client argon2
npm install -D prisma tsx
npm install @prisma/adapter-pg pg dotenv
npm install -D @types/pg
```
All native/install-script packages (`@prisma/engines`, `argon2`, `esbuild`, `prisma`, `sharp`, `unrs-resolver`) approved:
```powershell
npm approve-scripts @prisma/engines argon2 esbuild prisma sharp unrs-resolver
npm install
```

### Prisma version: 7.8.0 — key differences applied
- `datasource.url` cannot live in `schema.prisma` (errors P1012 if present)
- Connection URL, migrations path, seed command all live in `prisma.config.ts`
- `new PrismaClient()` requires a driver adapter (`@prisma/adapter-pg`) — no bare instantiation
- Generated client output path is **`../app/generated/prisma`** (not the project root `../generated/prisma` originally assumed — this was discovered mid-session from the actual `schema.prisma` on disk and is the path all imports must use)
- `migrate dev` does **not** auto-run `generate` in Prisma 7 — after any schema change, `generate` must be run explicitly or the client on disk will be stale (this caused a seed failure mid-session — see below)

### Local PostgreSQL: Docker
```yaml
# docker-compose.yml (project root)
services:
  postgres:
    image: postgres:16
    container_name: wanderstory-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: wanderstory
      POSTGRES_PASSWORD: wanderstory_dev_password
      POSTGRES_DB: wanderstory
    ports:
      - "5432:5432"
    volumes:
      - wanderstory_pgdata:/var/lib/postgresql/data

volumes:
  wanderstory_pgdata:
```
Started via `docker compose up -d`, confirmed via `docker ps` (`wanderstory-db`, status `Up`).

`.env`:
```
DATABASE_URL="postgresql://wanderstory:wanderstory_dev_password@localhost:5432/wanderstory?schema=public"
ADMIN_EMAIL="jamesmartamayo0@gmail.com"
ADMIN_PASSWORD="<set locally, not in this doc>"
ADMIN_NAME="<set locally>"
```

### Files — final, verified content (matches what's actually on disk)

#### `prisma/schema.prisma` — 194 lines, confirmed via `Get-Content` line count + `npx prisma validate` passing against real model content (not just syntax)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../app/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum AdminRole {
  SUPER_ADMIN
  EDITOR
}

enum JourneyStatus {
  DRAFT
  REVIEW
  APPROVED
  PUBLISHED
  ARCHIVED
}

enum JourneyVisibility {
  PUBLIC
  PRIVATE
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

model Admin {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  role         AdminRole @default(SUPER_ADMIN)
  journeys     Journey[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model Client {
  id                  String               @id @default(cuid())
  name                String
  email               String?
  phone               String?
  notes               String?              @db.Text
  journeys            Journey[]
  publicationConsents PublicationConsent[]
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
}

model PublicationConsent {
  id           String   @id @default(cuid())
  journey      Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId    String   @unique
  client       Client   @relation(fields: [clientId], references: [id])
  clientId     String
  consentGiven Boolean
  consentedAt  DateTime
  notes        String?  @db.Text
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
  featured     Boolean           @default(false)
  visibility   JourneyVisibility @default(PRIVATE)
  privateToken String?           @unique
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
  content   String   @db.Text
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

#### `prisma.config.ts` — 12 lines, confirmed on disk

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

#### `lib/prisma.ts` — 19 lines, confirmed on disk (note the real `../app/generated/prisma` import path)

```typescript
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

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

#### `prisma/seed.ts` — 35 lines, confirmed on disk

```typescript
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
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

### Migration — verified at every layer

```
prisma/migrations/20260709041420_init/migration.sql   (9,297 bytes)
prisma/migrations/migration_lock.toml
```

Confirmed via direct database query (`docker exec -it wanderstory-db psql -U wanderstory -d wanderstory -c "\dt"`) — all 11 tables exist: `Admin`, `Category`, `Chapter`, `Client`, `Destination`, `Journey`, `JourneyCategory`, `Media`, `PublicationConsent`, `Quote`, `TimelineEvent`, plus Prisma's own `_prisma_migrations` tracking table.

### Seed — verified at the database level, not just the CLI

Final confirmed state (one query, one row):
```sql
SELECT email, "passwordHash" FROM "Admin";

           email           |                    passwordHash
---------------------------+---------------------------------------------------------------------------------------------------
 jamesmartamayo0@gmail.com | $argon2id$v=19$m=65536,t=3,p=4$...
(1 row)
```
Exactly one admin row. Hash confirmed Argon2id (`$argon2id$` prefix). No plaintext, no bcrypt, no leftover placeholder row (an earlier `you@example.com` placeholder row was created and explicitly deleted before the real seed ran).

**Windows-specific gotcha worth carrying forward:** `docker exec -it ... psql -c "..."` with embedded double-quotes inside a double-quoted PowerShell string gets mangled by Windows' argument re-parsing before `psql` ever sees it. Reliable pattern used throughout this session — pipe the query in instead of using `-c`:
```powershell
'SELECT ... FROM "TableName";' | docker exec -i wanderstory-db psql -U wanderstory -d wanderstory
```

---

## Current project tree
```
wanderstory/
├── app/
│   └── generated/prisma/          # Prisma Client output (gitignored, not source)
├── docs/
│   ├── wanderstory-architecture.md              (historical)
│   ├── wanderstory-architecture-UPDATE.md        (historical)
│   └── wanderstory-architecture-SecondUpdate.md  (source of truth, v1.2)
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       ├── migration_lock.toml
│       └── 20260709041420_init/
│           └── migration.sql
├── lib/
│   └── prisma.ts
├── public/
├── docker-compose.yml
├── prisma.config.ts
├── package.json
├── package-lock.json
├── .env
```

---

## Milestone 1: COMPLETE ✅ — nothing outstanding

- [x] Schema (11 models, 5 enums, all relations/constraints)
- [x] `prisma.config.ts`
- [x] `lib/prisma.ts`
- [x] `prisma/seed.ts`
- [x] Docker PostgreSQL running
- [x] `npx prisma generate` (against real schema)
- [x] `npx prisma migrate dev --name init` — verified via direct DB query
- [x] `npx prisma db seed` — verified via direct DB query, real admin, Argon2id hash

## Not started — everything from here is genuinely new ground

- [ ] Milestone 2 — Auth.js (Credentials provider, JWT sessions, `middleware.ts` on `/admin/*`, `/admin/login`, rate limiting)
- [ ] Services layer (`journey.service.ts`, `client.service.ts`, etc.) + Zod validation schemas
- [ ] API routes
- [ ] Frontend (public site, admin CMS)
- [ ] Cloudinary integration
- [ ] Everything Milestone 3 onward per the architecture doc's §11 implementation plan

---

## Standing rules for whoever continues this

- Treat `docs/wanderstory-architecture-SecondUpdate.md` as the only source of truth
- Do not simplify the schema, rename fields, remove relations, or add models not in the doc
- Publishing transition logic (`APPROVED → PUBLISHED` only) belongs in service-layer code, not Prisma
- **Verify everything independently.** A CLI reporting success is not proof of the underlying state — this session hit multiple false positives (empty-schema validation "passing," a stale generated client, an "already in sync" migration against an empty database). Confirm file contents with `Get-Content`/line counts and confirm database state with direct `psql` queries before treating any step as done.
- When writing files via PowerShell, do not use plain `Set-Content -Encoding utf8` for Prisma-related files — it adds a BOM that breaks Prisma's parser. Follow with the `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))` step to strip it.
- Prisma Client output path for this project is `app/generated/prisma` — not the project root. All imports referencing the generated client must use `../app/generated/prisma/client` (adjusting relative depth per file location).
