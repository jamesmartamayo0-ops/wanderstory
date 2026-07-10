# WanderStory — Phase 1 Technical Architecture

**Status:** Foundation approved — v1.2 (pre-implementation corrections applied)
**Scope:** Phase 1 (MVP) only, architected so Phases 2–4 extend without rewrites
**Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, Cloudinary, Auth.js, Vercel

> **Changelog v1.2:** `Client.email` made optional; added `Journey.privateToken` as the actual mechanism behind private delivery links; added `@@unique([journeyId, order])` constraints on `Chapter`, `TimelineEvent`, and `Quote` to guarantee ordering integrity; confirmed the publishing pipeline explicitly transitions `APPROVED → PUBLISHED` only.
>
> **Changelog v1.1:** Added `Client` model (admin-managed, no login), `PublicationConsent` model (tracks public/private permission + timestamp), expanded `JourneyStatus` to a full editorial pipeline (`DRAFT → REVIEW → APPROVED → PUBLISHED`, plus `ARCHIVED`), and added `Journey.featured` for homepage curation.

---

## 1. System Architecture Overview

WanderStory is a **single Next.js application** acting as both the public editorial site and the private admin CMS. There is no separate backend service — Route Handlers under `app/api/` serve as the API layer, and Server Components fetch data directly via Prisma where possible (no need to round-trip through the API for server-rendered pages).

```
                        ┌─────────────────────────────┐
                        │        Vercel Edge          │
                        │   (Next.js 15 App Router)   │
                        └──────────────┬───────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼─────────┐   ┌──────────▼──────────┐   ┌─────────▼─────────┐
    │   Public Routes    │   │   Admin Routes       │   │   API Route        │
    │  (Server Components)│  │  (Auth-protected)    │   │   Handlers         │
    │  Static + ISR       │  │  Server Components + │   │  /api/journeys     │
    │  /, /stories, /[slug]│ │  Client interactivity│   │  /api/media        │
    │  /destinations/*    │  │  /admin/*            │   │  /api/upload       │
    │  /categories/*      │  │                       │   │  /api/auth/*       │
    └─────────┬───────────┘   └──────────┬───────────┘   └─────────┬─────────┘
              │                          │                          │
              └────────────┬─────────────┴─────────────┬────────────┘
                           │                             │
                 ┌─────────▼─────────┐         ┌─────────▼─────────┐
                 │   Prisma ORM       │         │   Cloudinary SDK   │
                 └─────────┬─────────┘         └─────────┬─────────┘
                           │                              │
                 ┌─────────▼─────────┐         ┌─────────▼─────────┐
                 │   PostgreSQL       │         │   Cloudinary CDN   │
                 │  (structured data) │         │  (all media assets)│
                 └────────────────────┘         └────────────────────┘
```

**Key architectural decisions:**

- **Postgres never stores binary media** — only Cloudinary URLs, public IDs, and derived metadata (dimensions, blur placeholder, format). This keeps the database small, fast, and easy to back up.
- **Published journeys are statically generated** (`generateStaticParams` + ISR revalidation on publish/edit) so visitor-facing pages are extremely fast and cheap to serve — critical for the "premium editorial" feel and for SEO.
- **Admin routes are fully dynamic and auth-gated** via middleware — no static generation there.
- **One Prisma schema, one Postgres instance** — no microservices. This is intentionally simple for a single-admin MVP but the schema is normalized in a way that supports multi-editor and multi-tenant growth later (see §9).

---

## 2. Database ERD

```
┌───────────────┐        ┌──────────────────────┐        ┌───────────────┐
│    Admin       │        │       Journey         │        │  Destination   │
├───────────────┤        ├──────────────────────┤        ├───────────────┤
│ id             │───┐    │ id                    │   ┌────│ id             │
│ email          │   │    │ slug (unique)         │   │    │ slug (unique)  │
│ passwordHash   │   └───▶│ authorId (FK)         │   │    │ name           │
│ name           │        │ clientId (FK)         │───┤    │ country        │
│ role           │        │ title                 │   │    │ region         │
│ createdAt      │        │ travelerName          │◀──┘    │ heroMediaId(FK)│
└───────────────┘        │ travelStartDate       │        │ description    │
                          │ travelEndDate         │        └───────┬────────┘
        ┌────────────────│ destinationId (FK)    │                │ 1:N
        │ 1:N             │ introduction          │                ▼
        ▼                 │ status (enum, 5 vals) │        (Journeys per
┌───────────────┐         │ featured (bool)       │         Destination)
│    Client      │         │ visibility (enum)     │
├───────────────┤         │ coverMediaId (FK)     │
│ id             │◀────────│ publishedAt           │
│ name           │         │ seoTitle              │
│ email          │         │ seoDescription        │
│ phone          │         │ ogImageId (FK)         │
│ notes          │         │ canonicalUrl          │
│ createdAt      │         │ structuredData (json) │
└───────┬────────┘         │ createdAt / updatedAt │
        │ 1:1 per journey  └──────────┬────────────┘
        ▼                             │
┌────────────────────┐   ┌────────────┼────────────┬────────────┬────────────────┐
│ PublicationConsent  │   │ 1:N        │ 1:N        │ 1:N        │ M:N             │ 1:N
├────────────────────┤   ▼            ▼            ▼            ▼                 ▼
│ id                  │┌──────────┐┌──────────────┐┌──────────┐┌────────────┐┌──────────────┐
│ journeyId (FK, 1:1) ││ Chapter   ││TimelineEvent  ││  Quote    ││  Category   ││    Media      │
│ clientId (FK)       │├──────────┤├──────────────┤├──────────┤├────────────┤├──────────────┤
│ consentGiven (bool) ││ id        ││ id            ││ id        ││ id          ││ id             │
│ consentedAt         ││journeyId  ││ journeyId(FK) ││journeyId  ││ slug        ││ cloudinaryId   │
│ notes               ││  (FK)     ││ date          ││  (FK)     ││ name        ││ url            │
└────────────────────┘│ title     ││ title         ││ text      ││ description ││ thumbnailUrl   │
                        │ order     ││ description   ││attribution│└─────┬──────┘│ mediumUrl      │
                        │ content   ││ order         ││ order     │      │        │ largeUrl       │
                        │  (md)     │└──────────────┘└──────────┘      │        │ webpUrl        │
                        │ createdAt │                            ┌───────▼──────┐│ blurDataUrl    │
                        └──────┬───┘                            │JourneyCategory││ width/height   │
                               │ 1:N                              │  (join table) ││ type (enum)    │
                               ▼                                  └──────────────┘│ role (enum)    │
                          (Media with                                              │ journeyId (FK) │
                           chapterId set)                                          │ chapterId (FK) │
                                                                                     │ altText        │
                                                                                     │ order          │
                                                                                     └──────────────┘
```

**Relationship summary:**

| Relationship | Type | Notes |
|---|---|---|
| Admin → Journey | 1:N | `authorId` prepares for multi-editor later |
| Client → Journey | 1:N | A repeat client (e.g. a travel agency contact) can have multiple journeys |
| Client → PublicationConsent | 1:N | Kept on Client too, in case consent is ever requested independent of a specific journey |
| Journey → PublicationConsent | 1:1 | Each journey has exactly one active consent record |
| Destination → Journey | 1:N | A journey has one primary destination |
| Journey ↔ Category | M:N | A journey can be both "Honeymoon" and "Luxury" |
| Journey → Chapter | 1:N | Ordered chapter sections |
| Journey → TimelineEvent | 1:N | Powers the interactive timeline |
| Journey → Quote | 1:N | Pull-quotes within the story |
| Journey → Media | 1:N | Cover image + gallery images/videos |
| Chapter → Media | 1:N | Images embedded inside a specific chapter |
| Destination → Media | 1:1 (hero) | Optional hero image for destination pages |

---

## 3. Prisma Schema Design

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
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
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         AdminRole @default(SUPER_ADMIN) // architecture-only field for Phase 1
  journeys     Journey[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
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
  id            String   @id @default(cuid())
  journey       Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId     String   @unique
  client        Client   @relation(fields: [clientId], references: [id])
  clientId      String
  consentGiven  Boolean  // true = publish publicly, false = keep private
  consentedAt   DateTime // when the client made this choice
  notes         String?  @db.Text // e.g. "confirmed via email 2026-07-09"
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([clientId])
}

model Journey {
  id               String            @id @default(cuid())
  slug             String            @unique
  title            String
  travelerName     String
  travelStartDate  DateTime
  travelEndDate    DateTime
  introduction     String            @db.Text

  status           JourneyStatus     @default(DRAFT)
  featured         Boolean           @default(false) // homepage editorial selection
  visibility       JourneyVisibility @default(PRIVATE)
  privateToken     String?           @unique // non-guessable token powering the private delivery link; set when visibility=PRIVATE
  publishedAt      DateTime?

  author           Admin             @relation(fields: [authorId], references: [id])
  authorId         String

  client           Client            @relation(fields: [clientId], references: [id])
  clientId         String

  destination      Destination       @relation(fields: [destinationId], references: [id])
  destinationId    String

  categories       JourneyCategory[]
  chapters         Chapter[]
  timelineEvents   TimelineEvent[]
  quotes           Quote[]
  media            Media[]
  publicationConsent PublicationConsent?

  coverMedia       Media?            @relation("JourneyCover", fields: [coverMediaId], references: [id])
  coverMediaId     String?           @unique

  // SEO — embedded directly on Journey for Phase 1 simplicity.
  // Extract into a related SeoMeta model in Phase 3 if fields grow.
  seoTitle         String?
  seoDescription   String?
  canonicalUrl     String?
  ogImage          Media?            @relation("JourneyOgImage", fields: [ogImageId], references: [id])
  ogImageId        String?           @unique
  structuredData   Json?

  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

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
  id            String    @id @default(cuid())
  slug          String    @unique
  name          String
  country       String
  region        String?
  description   String?   @db.Text
  heroMedia     Media?    @relation(fields: [heroMediaId], references: [id])
  heroMediaId   String?   @unique
  journeys      Journey[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
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
  id               String     @id @default(cuid())
  cloudinaryId     String     @unique
  url              String
  thumbnailUrl     String
  mediumUrl        String
  largeUrl         String
  webpUrl          String
  blurDataUrl      String?    @db.Text
  width            Int
  height           Int
  format           String
  type             MediaType
  role             MediaRole
  altText          String?
  order            Int        @default(0)

  journey          Journey?   @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId        String?

  chapter          Chapter?   @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  chapterId        String?

  journeyCover     Journey?   @relation("JourneyCover")
  journeyOgImage   Journey?   @relation("JourneyOgImage")
  destinationHero  Destination?

  createdAt        DateTime   @default(now())

  @@index([journeyId])
  @@index([chapterId])
}
```

**Design notes:**

- `Media` is a single polymorphic-ish table (nullable `journeyId` / `chapterId`) rather than separate tables per context. This avoids duplicating the Cloudinary-variant logic three times and keeps the media library (Phase 1 admin feature) queryable from one place.
- `structuredData` on `Journey` is a raw `Json` field so JSON-LD (Article / TravelAction schema) can be generated flexibly without new columns.
- Cascading deletes are scoped so deleting a Journey cleans up its Chapters, TimelineEvents, Quotes, and Media — but Destination and Category are never cascade-deleted (they're reference data), and `Client` is never cascade-deleted by a Journey removal either.
- **`Journey.visibility` vs. `PublicationConsent.consentGiven`** — these are deliberately separate rather than collapsed into one field: `consentGiven` is the client's recorded permission (the source of truth, with a timestamp for accountability), while `visibility` is the operational switch the admin actually publishes with. In practice the admin sets `visibility` to match consent, but keeping them distinct means a consent record can exist and be auditable even before a journey is published, and the admin retains the final publish decision. The Journey admin form should default/lock `visibility` to the consent value to prevent accidental mismatches, enforced at the application layer rather than the database.
- `Client` is intentionally a plain contact record — no auth fields, no password, nothing login-related. It exists purely so the admin can track who a journey belongs to and reuse client info across repeat bookings. `email` is optional since not every lead arrives with one on file initially.
- **Ordering integrity**: `Chapter`, `TimelineEvent`, and `Quote` each carry a `@@unique([journeyId, order])` constraint, so two items within the same journey can never silently collide on order — the service layer must shift/renumber siblings on reorder rather than relying on the UI alone to keep order values consistent.
- **`privateToken`** is the actual mechanism behind private delivery links (see §5) — a separate random value from `slug`, generated when a journey is set to `PRIVATE`, so the public-facing `slug` can stay human-readable without doubling as a security boundary.

---

## 4. Admin Workflow

```
 Login (Auth.js) ──▶ Dashboard
                        │
                        ▼
              ┌─────────────────────┐
              │  Add/select Client    │
              │  (contact info,       │
              │   admin-managed only) │
              └──────────┬───────────┘
                         ▼
              ┌─────────────────────┐
              │   Create Journey     │  status = DRAFT
              │  (draft autosave)    │  clientId = selected Client
              └──────────┬───────────┘
                         │
         ┌───────────────┼───────────────────┐
         ▼                ▼                    ▼
   Fill metadata     Upload media        Write chapters
   (title, dates,    → Cloudinary        + timeline events
   destination,       upload widget      + quotes
   category)          → optimized        (draft autosave
                       variants stored    on interval)
                       in Media table
         └───────────────┼───────────────────┘
                         ▼
                  Preview (draft render
                  using the same public
                  story template)
                         │
                         ▼
              status = REVIEW (admin's own
              editorial pass on the draft)
                         │
                         ▼
              Record PublicationConsent
              (consentGiven + consentedAt,
               captured from client's choice
               — email/form, logged by admin)
                         │
                         ▼
              status = APPROVED
              visibility set to match consent
              (PUBLIC if consentGiven=true,
               else PRIVATE)
                         │
                         ▼
                     Publish
                         │
                         ▼
        status = PUBLISHED, publishedAt = now()
        → triggers on-demand ISR revalidation
          for /stories/[slug], /destinations/[slug],
          /categories/[slug], and the homepage
        → admin may also toggle `featured` at
          this point, or any time after, to
          surface the story on the homepage
                         │
                         ▼
              Client receives public URL
              (or private link if visibility=PRIVATE)
                         │
                         ▼
        (optional, later) status = ARCHIVED
        — pulled from public listings and
          sitemap, record retained
```

**Key admin UX principles baked into the architecture (per your engineering standards):**

- **Autosave**: journey drafts persist to Postgres on a debounced interval via a Server Action — no "save" button anxiety.
- **Preview before publish**: the admin preview route renders the *exact* public story template against draft data (same React components, different data source), so there's no surprise between preview and live.
- **Publish is a single state transition** (`DRAFT → PUBLISHED`), not a separate content pipeline — reduces admin cognitive load, matches "reduce unnecessary clicks."

---

## 5. Public Visitor Workflow

```
Visitor lands on Homepage (SSG/ISR)
        │  (queries filter on status = PUBLISHED AND visibility = PUBLIC;
        │   DRAFT/REVIEW/APPROVED/ARCHIVED journeys never appear publicly)
        │
        ├──▶ Featured Story (journeys where featured = true, admin-curated)
        │        / Latest Stories / Editor's Picks
        │        │
        │        ▼
        │   Story Page (/stories/[slug])
        │   — statically generated for PUBLIC + PUBLISHED journeys
        │   — hero, timeline, chapters, quotes, gallery, map, related stories
        │
        ├──▶ Destinations (/destinations/[slug])
        │        → filtered list of public journeys for that destination
        │
        ├──▶ Categories (/categories/[slug])
        │        → filtered list of public journeys for that category
        │
        └──▶ Contact → inquiry form → email/notification to admin
                (no account creation, no auth — simple lead capture)
```

**Private journeys**: a `PRIVATE` journey is still statically generated (for performance) but delivered via a dedicated `privateToken` — a non-guessable random token generated at creation/publish time — rather than the public `slug` alone, and rather than by login. The private route (e.g. `/stories/private/[privateToken]`) is consistent with "no traveler dashboard, no accounts." It is excluded from all listing queries (`destinations`, `categories`, homepage, sitemap) and from `sitemap.ts`.

**Clients never have a public-facing account or dashboard.** The `Client` model exists purely for the admin's internal record-keeping and to power the private delivery link — it has no bearing on the visitor-facing site beyond that.

---

## 6. Cloudinary Media Architecture

**Upload flow:**

1. Admin selects file in the dashboard → signed upload request generated by a Route Handler (`/api/upload/sign`) using Cloudinary's signed upload preset — the API secret never touches the client.
2. Browser uploads directly to Cloudinary (bypasses our server for the binary transfer — faster, no Vercel payload limits).
3. Cloudinary webhook (or client-side `on success` callback, validated server-side) returns the `public_id` and metadata.
4. Server creates a `Media` row with:
   - `cloudinaryId`
   - Derived URLs for each variant using Cloudinary transformation URLs (no separate upload per size — Cloudinary generates these on-the-fly and caches at the CDN edge):
     - `thumbnailUrl` — `c_fill,w_320,h_320,q_auto,f_auto`
     - `mediumUrl` — `c_limit,w_1200,q_auto,f_auto`
     - `largeUrl` — `c_limit,w_2400,q_auto,f_auto`
     - `webpUrl` — `f_webp` variant explicitly for browsers that prefer it (Next/Image will mostly handle format negotiation itself, but this is kept for non-Next contexts like OG tags/email)
   - `blurDataUrl` — a tiny base64 LQIP generated via Cloudinary's `e_blur:1000,w_20` transformation, fetched once at upload time and stored inline for instant placeholder rendering.
5. Next.js `<Image>` component consumes these URLs directly (Cloudinary already serves responsive, auto-format, auto-quality images — Next's own image optimizer is bypassed via a custom loader pointing at Cloudinary to avoid double-processing).

**Why store derived URLs instead of generating them at render time?** It keeps the render path a pure read (no URL-building logic scattered across components), and makes it trivial to swap the CDN/provider later — the `Media` model is the abstraction boundary.

---

## 7. Authentication Approach

- **Auth.js (NextAuth v5)** with the **Credentials provider** — email + password against the single `Admin` record, password hashed with **Argon2id** (via the `argon2` package) — the current recommended default over bcrypt for new systems.
- No sign-up flow — the one admin account is seeded via a script (`prisma/seed.ts`), not through the UI.
- Session strategy: **JWT** (not database-backed sessions) — appropriate at this scale, avoids an extra table/query on every request.
- `middleware.ts` protects everything under `/admin/*`, redirecting unauthenticated requests to `/admin/login`.
- Rate limiting on the login route (e.g. via a simple in-memory or Upstash-backed limiter) to blunt brute-force attempts, since it's a single high-value account.
- CSRF protection comes largely for free via Auth.js's built-in handling for Credentials sign-in; all mutating Route Handlers additionally validate `Origin`/`Referer` for defense in depth.

This is intentionally the simplest secure option for one admin, but because the `Admin` model already has a `role` enum and every `Journey` already carries an `authorId`, adding a second editor later is a matter of an invite flow + a permissions check — not a schema migration.

---

## 8. Folder Structure Recommendation

```
wanderstory/
├── app/
│   ├── (public)/                 # public route group — SSG/ISR
│   │   ├── page.tsx               # homepage
│   │   ├── about/page.tsx
│   │   ├── stories/
│   │   │   ├── page.tsx           # story index / search / filters
│   │   │   └── [slug]/page.tsx    # story template
│   │   ├── destinations/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── categories/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   └── contact/page.tsx
│   ├── admin/                     # auth-protected, dynamic
│   │   ├── login/page.tsx
│   │   ├── layout.tsx             # wraps all admin pages with sidebar/auth check
│   │   ├── page.tsx                # dashboard
│   │   ├── journeys/
│   │   │   ├── page.tsx            # list + drafts/published tabs
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── clients/page.tsx        # client contact records
│   │   ├── media/page.tsx          # media library
│   │   ├── destinations/page.tsx
│   │   ├── categories/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── journeys/route.ts
│   │   ├── journeys/[id]/route.ts
│   │   ├── upload/sign/route.ts
│   │   ├── contact/route.ts
│   │   └── revalidate/route.ts     # on-demand ISR trigger on publish/edit
│   ├── sitemap.ts
│   ├── robots.ts
│   └── layout.tsx
│
├── components/                     # pure, reusable, presentational
│   ├── ui/                         # Button, Card, Modal, Skeleton, etc.
│   └── layout/                     # Navigation, Footer, Breadcrumb
│
├── features/                       # feature-scoped composites
│   ├── story/                      # StoryHero, Timeline, ChapterSection, QuoteBlock, MapBlock
│   ├── journey-editor/             # admin: JourneyForm, ChapterEditor, MediaUploader
│   ├── destination/
│   ├── category/
│   └── home/                       # FeaturedStory, StoryGrid, EditorsPicks
│
├── lib/
│   ├── prisma.ts                   # Prisma client singleton
│   ├── auth.ts                     # Auth.js config
│   ├── cloudinary.ts               # upload signing, URL builders
│   └── validation/                 # Zod schemas shared client/server
│
├── services/                       # data-access layer — the ONLY place
│   ├── journey.service.ts          # that talks to Prisma directly from
│   ├── client.service.ts           # Server Components/Actions/Route Handlers
│   ├── consent.service.ts          # (records/updates PublicationConsent,
│   │                                #  keeps Journey.visibility in sync)
│   ├── media.service.ts
│   ├── destination.service.ts
│   └── category.service.ts
│
├── hooks/                          # client-side hooks (useAutosave, useUpload)
├── types/                          # shared TS types/interfaces (incl. Prisma-derived DTOs)
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── styles/                         # Tailwind config, design tokens
├── public/
└── middleware.ts
```

**Why a `services/` layer:** every data mutation/query goes through a service function, never raw `prisma.*` calls scattered in components or route handlers. This is what makes multi-editor permissions, caching, and future API versioning possible without touching UI code — it's the seam Phase 2–4 will grow from.

---

## 9. Future Scalability Considerations

Architected for now, **not built** now:

| Future need | How today's foundation supports it |
|---|---|
| Multi-editor / roles | `Admin.role` enum + `Journey.authorId` already exist; add a permissions middleware layer in `services/`, no schema change needed |
| Multiple destinations per journey | Currently 1:N (`Journey.destinationId`); can migrate to a join table (`JourneyDestination`) later — isolated to `Destination` relations, doesn't touch Media/Chapter logic |
| Travel agencies / hotel partner accounts | `Admin` model can gain a `Organization` parent relation; `Journey` can gain an optional `organizationId` for white-labeled collections |
| Multilingual content | `Journey` text fields can be extracted into a `JourneyTranslation` table keyed by locale, following the same pattern as `structuredData` — avoids a rewrite of the core model |
| Comments/likes (if ever revisited) | Deliberately excluded from schema now; would be fully additive tables (`Comment`, `Like`) with no impact on existing relations |
| Search/filtering (Phase 2) | `Journey`, `Category`, `Destination` are already normalized and indexed on the fields filters will need (`status`, `visibility`, `destinationId`) |
| PDF/print export (Phase 3) | Chapters/media are already structured, ordered data — a PDF renderer just needs a read path, no new write model |
| Analytics (Phase 3) | Can be bolted on via a separate lightweight `PageView` table or a third-party tool (Plausible/Vercel Analytics) without touching the content schema |
| Client self-service portal (explicitly future, not Phase 1) | `Client` already exists as a distinct entity from `Admin`; adding login would mean adding auth fields to `Client` and a scoped session — the underlying record doesn't need to move |
| Consent history / audit trail | `PublicationConsent` is currently one row per journey (latest decision only); a future `ConsentHistory` table can log every change without altering the current-state model |
| Editorial review by multiple people (Phase 2+) | The `REVIEW`/`APPROVED` statuses already exist in the enum; assigning *who* reviewed just needs a `reviewedById` field added later, no new pipeline |

---

## 10. What Phase 1 Explicitly Does NOT Include

Per the master prompt's guardrails — confirmed absent from this architecture:

- No `User`/traveler accounts, no session for visitors
- No client login — `Client` is a contact record only, managed entirely by the admin
- No `Comment`, `Like`, `Follow`, or `Message` models
- No payment/subscription models
- No multi-tenant `Organization` table (only *prepared for*, not built)
- No search infrastructure (Elasticsearch/Algolia) — Phase 2 concern
- No i18n tables — Phase 4 concern

---

## 11. Phase 1 Implementation Plan

Sequenced so each milestone produces something runnable/testable, and later milestones never require reworking earlier ones. No Phase 2–4 features included.

### Milestone 0 — Project Setup
- Initialize Next.js 15 (App Router, TypeScript, Tailwind) project
- Configure ESLint + Prettier
- Set up folder structure per §8
- Provision PostgreSQL (e.g. Neon/Supabase/Railway for dev+prod) and Cloudinary account
- `.env` scaffolding + Vercel project linked, env vars set (never committed)

### Milestone 1 — Data Layer
- Write `prisma/schema.prisma` per §3 (including v1.1 models)
- Run initial migration
- Write `prisma/seed.ts` — creates the one `Admin` account
- Build `lib/prisma.ts` singleton
- Build `services/` layer stubs (`journey.service.ts`, `client.service.ts`, `consent.service.ts`, `media.service.ts`, `destination.service.ts`, `category.service.ts`) with core CRUD functions and Zod validation schemas in `lib/validation/`

### Milestone 2 — Authentication
- Configure Auth.js (Credentials provider, JWT sessions) per §7
- `middleware.ts` protecting `/admin/*`
- `/admin/login` page
- Rate limiting on login route

### Milestone 3 — Admin Core: Clients & Journeys
- Client CRUD (`/admin/clients`) — create/edit/list contact records
- Journey CRUD (`/admin/journeys`) — create/edit/list, linked to a Client and Destination
- Destination & Category admin CRUD (simple reference-data management)
- Autosave on the journey editor (debounced Server Action)
- Status pipeline UI: DRAFT → REVIEW → APPROVED → PUBLISHED, with `ARCHIVED` as a terminal admin action
- `featured` toggle on the journey editor

### Milestone 4 — Media Pipeline
- Cloudinary signed upload flow (`/api/upload/sign`)
- Upload widget in `features/journey-editor/`
- On successful upload, create `Media` row with derived variant URLs + blur placeholder (§6)
- Media library view (`/admin/media`) — browse/reuse uploaded assets across journeys

### Milestone 5 — Story Authoring
- Chapter editor (ordered, markdown/rich-text content) in `features/journey-editor/`
- Timeline event editor
- Quote block editor
- Cover image / OG image selection from Media
- Draft preview route rendering the real public story template against draft data

### Milestone 6 — Publication Consent
- Consent capture UI on the journey editor (`consentGiven`, `consentedAt`, `notes`)
- Enforce in the application layer: `visibility` field is derived from/locked to `consentGiven` when moving to `APPROVED`
- Prevent publishing without a recorded consent decision

### Milestone 7 — Public Site
- Homepage (`/`) — Hero, Featured Story (`featured = true`), Latest Stories, Editor's Picks, Popular Destinations, Categories, About teaser, CTA, Footer
- Story template (`/stories/[slug]`) — full editorial layout per the master prompt's story page structure
- Destination pages (`/destinations/[slug]`)
- Category pages (`/categories/[slug]`)
- About, Contact (simple inquiry form → email notification, no DB persistence needed for Phase 1 unless you want inquiries logged — flag this if you do)
- All public queries filter `status = PUBLISHED AND visibility = PUBLIC`; private journeys reachable only via direct unlisted-slug link

### Milestone 8 — SEO & Performance
- `sitemap.ts`, `robots.ts`
- Per-journey SEO fields wired to `<head>` meta, Open Graph, Twitter Card, JSON-LD (`structuredData`)
- Static generation for published/public journeys + destinations + categories; ISR revalidation triggered on publish/edit via `/api/revalidate`
- Image optimization audit, Lighthouse pass, accessibility pass

### Milestone 9 — Hardening & Launch
- Input validation coverage review (Zod on every mutation)
- CSRF/Origin checks on Route Handlers
- Rate limiting review
- Environment variable audit (no secrets exposed client-side)
- Deploy to Vercel production, connect custom domain

**Explicitly out of scope for this plan:** search/filtering UI, testimonials, animations polish beyond baseline, maps, video embeds, dark mode, PDF export, analytics dashboard, multilingual — all Phase 2–4 per the master prompt.

---

*This document is the approved foundation for Phase 1. Next step, when you're ready: begin Milestone 0 (project scaffolding).*
