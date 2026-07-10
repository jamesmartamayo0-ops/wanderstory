# WanderStory — Phase 1 Technical Architecture

**Status:** Foundation document — no implementation yet
**Scope:** Phase 1 (MVP) only, architected so Phases 2–4 extend without rewrites
**Stack:** Next.js 15, TypeScript, Prisma, PostgreSQL, Cloudinary, Auth.js, Vercel

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
│ name           │        │ title                 │   │    │ country        │
│ role           │        │ travelerName          │◀──┘    │ region         │
│ createdAt      │        │ travelStartDate       │        │ heroMediaId(FK)│
└───────────────┘        │ travelEndDate         │        │ description    │
                          │ destinationId (FK)    │        └───────┬────────┘
                          │ introduction          │                │ 1:N
                          │ status (enum)         │                ▼
                          │ visibility (enum)     │        (Journeys per
                          │ coverMediaId (FK)     │         Destination)
                          │ publishedAt           │
                          │ seoTitle              │
                          │ seoDescription        │
                          │ ogImageId (FK)         │
                          │ canonicalUrl          │
                          │ structuredData (json) │
                          │ createdAt / updatedAt │
                          └──────────┬────────────┘
                                     │
        ┌───────────────┬────────────┼────────────┬────────────────┐
        │ 1:N            │ 1:N        │ 1:N        │ M:N             │ 1:N
        ▼                ▼            ▼            ▼                 ▼
┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐
│   Chapter     │ │TimelineEvent │ │  Quote    │ │  Category   │ │    Media      │
├──────────────┤ ├──────────────┤ ├──────────┤ ├────────────┤ ├──────────────┤
│ id            │ │ id            │ │ id        │ │ id          │ │ id             │
│ journeyId(FK) │ │ journeyId(FK) │ │journeyId  │ │ slug        │ │ cloudinaryId   │
│ title         │ │ date          │ │  (FK)     │ │ name        │ │ url            │
│ order         │ │ title         │ │ text      │ │ description │ │ thumbnailUrl   │
│ content (md)  │ │ description   │ │attribution│ └─────┬──────┘ │ mediumUrl      │
│ createdAt     │ │ order         │ │ order     │       │        │ largeUrl       │
└──────┬────────┘ └──────────────┘ └──────────┘       │        │ webpUrl        │
       │ 1:N                                   ┌───────▼──────┐ │ blurDataUrl    │
       ▼                                       │JourneyCategory│ │ width/height   │
   (Media with                                 │  (join table) │ │ type (enum)    │
    chapterId set)                             └──────────────┘ │ role (enum)    │
                                                                  │ journeyId (FK) │
                                                                  │ chapterId (FK) │
                                                                  │ altText        │
                                                                  │ order          │
                                                                  └──────────────┘
```

**Relationship summary:**

| Relationship | Type | Notes |
|---|---|---|
| Admin → Journey | 1:N | `authorId` prepares for multi-editor later |
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
  DRAFT
  PUBLISHED
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

model Journey {
  id               String            @id @default(cuid())
  slug             String            @unique
  title            String
  travelerName     String
  travelStartDate  DateTime
  travelEndDate    DateTime
  introduction     String            @db.Text

  status           JourneyStatus     @default(DRAFT)
  visibility       JourneyVisibility @default(PRIVATE)
  publishedAt      DateTime?

  author           Admin             @relation(fields: [authorId], references: [id])
  authorId         String

  destination      Destination       @relation(fields: [destinationId], references: [id])
  destinationId    String

  categories       JourneyCategory[]
  chapters         Chapter[]
  timelineEvents   TimelineEvent[]
  quotes           Quote[]
  media            Media[]

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
}

model Quote {
  id          String  @id @default(cuid())
  journey     Journey @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  journeyId   String
  text        String  @db.Text
  attribution String?
  order       Int
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
- Cascading deletes are scoped so deleting a Journey cleans up its Chapters, TimelineEvents, Quotes, and Media — but Destination and Category are never cascade-deleted (they're reference data).

---

## 4. Admin Workflow

```
 Login (Auth.js) ──▶ Dashboard
                        │
                        ▼
              ┌─────────────────────┐
              │   Create Journey     │
              │  (draft autosave)    │
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
              Set visibility: PUBLIC / PRIVATE
                         │
                         ▼
                     Publish
                         │
                         ▼
        status = PUBLISHED, publishedAt = now()
        → triggers on-demand ISR revalidation
          for /stories/[slug], /destinations/[slug],
          /categories/[slug], and the homepage
                         │
                         ▼
              Client receives public URL
              (or private link if visibility=PRIVATE)
```

**Key admin UX principles baked into the architecture (per your engineering standards):**

- **Autosave**: journey drafts persist to Postgres on a debounced interval via a Server Action — no "save" button anxiety.
- **Preview before publish**: the admin preview route renders the *exact* public story template against draft data (same React components, different data source), so there's no surprise between preview and live.
- **Publish is a single state transition** (`DRAFT → PUBLISHED`), not a separate content pipeline — reduces admin cognitive load, matches "reduce unnecessary clicks."

---

## 5. Public Visitor Workflow

```
Visitor lands on Homepage (SSG/ISR)
        │
        ├──▶ Featured Story / Latest Stories / Editor's Picks
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

**Private journeys**: a `PRIVATE` journey is still statically generated (for performance) but at an unlisted route protected by a non-guessable slug (e.g. a longer random slug segment) rather than by login — consistent with "no traveler dashboard, no accounts." It is excluded from all listing queries (`destinations`, `categories`, homepage, sitemap).

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

- **Auth.js (NextAuth v5)** with the **Credentials provider** — email + password against the single `Admin` record, password hashed with `bcrypt` (or `argon2`).
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
│   ├── media.service.ts            # Server Components/Actions/Route Handlers
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

---

## 10. What Phase 1 Explicitly Does NOT Include

Per the master prompt's guardrails — confirmed absent from this architecture:

- No `User`/traveler accounts, no session for visitors
- No `Comment`, `Like`, `Follow`, or `Message` models
- No payment/subscription models
- No multi-tenant `Organization` table (only *prepared for*, not built)
- No search infrastructure (Elasticsearch/Algolia) — Phase 2 concern
- No i18n tables — Phase 4 concern

---

*This document is the foundation for Phase 1 implementation. Next step, when you're ready: scaffold the actual Next.js project structure and Prisma migrations from this design.*
