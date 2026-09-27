# DormScout

An independent, working student dorm-review app. This is a separate application, database, source repository, and deployment from the other campus product.

## Included

- Search by listing name, university, metadata, or feature; filter university and category.
- Sort by rating, review count, or name.
- Compare up to three listings in an accessible table.
- Read reviews, filter by term, and inspect rating sample sizes.
- Sign in with the hosting platform, create listings for a real university, write a review, edit it, and delete it.
- Durable D1 storage. One review per signed-in person per listing; edits update it instead of duplicating votes.
- Anonymous public display; account identifiers stay server-side and are used for ownership. Email is not stored in D1.
- Responsive layouts, accessible dialog/select/checkbox primitives, keyboard focus, error handling that preserves drafts, and a reduced-motion style.
- An optional WebMCP search tool uses the same visible filtering state.

## Data and audience

The initial Northbridge University catalog and its reviews are explicitly fictional. Demo reviews never silently become real reviews. Turn off “Include demo campus” to show only user-added listings. Real university catalogs and real student reviews were not fabricated or scraped. Add a university listing through the UI to start collecting real submissions.

The first deployment is owner-private. Authentication is not proof of university enrollment or residency. This app does not claim verified students, official course eligibility, current housing availability, or a campus affiliation. Review guidelines explain these limits. There is no public moderation console, email verification, paid integration, or photo-upload workflow in this release. A broader public community would need a defined moderation operator and abuse-response process before expanding its audience.

## Run locally

Requires Node >=22.13.0. Install the locked dependencies with `npm run install:ci`. Run `npm run dev -- --port 5173`.

The starter simulates sign-in only on loopback development requests. `/signin-with-chatgpt?return_to=/` creates the local test identity; production sign-in is managed by the host, not this application.

## Database

Logical binding: `DB` in `.openai/hosting.json`. Schema: `db/schema.ts`. API queries use bound parameters through `lib/database.ts`. Migrations are generated with `npm run db:generate`; inspect and commit them. Never edit an applied migration.

For the first local setup, run `npm run build`, then apply the generated `drizzle/0000_*.sql` file once:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file <migration-file>
```

Publishing applies migrations separately to hosted D1. Local test data is not uploaded. No schema or seed mutations run at request time.

## Tests

```sh
node --test tests/domain.test.ts
npx tsc --noEmit
TEST_ORIGIN=http://localhost:5173 TEST_KIND=dorm node tests/integration.mjs
```

The integration suite refuses non-loopback targets. It signs in as the local test user and exercises real HTTP endpoints and D1 persistence. It creates a clearly named Integration Test University listing in the local database; it removes the reviews it creates. Do not run against an existing local review you wish to preserve on example-1, because that review is used for update/delete coverage.

## API contract

- `GET /api/catalog`: listings with reviews and current-user `own` flags. Private/no-store response; excludes account IDs and emails.
- `POST /api/catalog`: authenticated, same-origin listing creation. Required: name, school, category, meta. Optional: up to five tags. University + title are normalized into a stable identity to deduplicate case-insensitive repeats. Limit: 20 new listings per user per hour.
- `POST /api/reviews`: authenticated, same-origin upsert. Validates listing, 1–5 integer ratings, review length (30–2000), term, attestation, and recommendation. Course reviews additionally require instructor and 0–80 outside-class hours/week.
- `DELETE /api/reviews?id=…`: authenticated, same-origin deletion constrained by the current user's ID.

The platform must retain its normal trusted-header boundary; do not expose the Worker directly behind a proxy that permits clients to spoof authenticated-user headers. Review bodies are rendered as text, never raw HTML. Storage failures return recoverable errors rather than fake success.

## Source map

`app/explorer.tsx`: UI and interactions. `lib/config.json`: app identity and clearly labeled examples. `lib/domain.ts`: validation, averages, filtering. `app/api/`: server endpoints. `db/` and `drizzle/`: schema and migrations. `app/globals.css`: independent visual identity.

## Research

Reviewed on September 25, 2026:

- https://www.ratemydorm.com/ — existing dorm-review product; DormScout is an independent working name, not an affiliation or claim to the existing brand.
- https://www.mydorm.com/ — dorm condition ratings and housing photos.
- https://www.ratemycourses.io/ — course and professor reviews with workload information.
- https://roboforbes.com/ — campus-specific course planning and reviews.

Product focus: compare living conditions rather than assume one aggregate score identifies the right home.

## Assets

The dorm-room image is original AI-generated illustrative artwork, visibly labeled in the UI; it is not evidence of a real campus or dorm. Source: /Users/t/Documents/Codex/assets/dormscout-illustrative-room.png. A compressed WebP is included in public/.

## Product polish, September 26

The review button opens a searchable listing picker. Unsaved review drafts survive closing/reopening a form in the same page session; they are deliberately not stored as submitted reviews and are cleared on reload. Listing details have copyable `?listing=...` URLs; existing private access restrictions still apply. Sign-in from a listing preserves the selected item and resumes review entry. Quick-search chips, clear-filter actions, visible phone navigation, explicit sample-size context, and unrated labels make the comparison flow clearer.

Course search includes instructor names in submitted reviews. Listing creation normalizes internal whitespace and returns an existing duplicate distinctly (`created: false`, HTTP 200). Known input errors are separate from internal failures, so unexpected backend exceptions are not exposed to the user. No database schema changes or new paid services were introduced.
