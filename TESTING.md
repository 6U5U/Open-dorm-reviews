# Verification record

- 17 domain tests passed: averages, missing-data behavior, combined filtering, search, ordering, review bounds, instructor/workload validation, confirmation, and listing validation.
- 25 HTTP integration assertions passed against the local D1 database: local sign-in, anonymous reads, authenticated writes, cross-origin rejection, validation, missing records, persistence, edit/upsert behavior, ownership checks, deletion, listing creation, duplicate detection, and demo separation.
- TypeScript checks passed.
- Production Worker build passed. Schema-only SQL migrations were inspected and applied successfully to separate local databases.
- Browser checks: search, filters, authenticated review submission, immediate average updates, and responsive presentation. Additional combined checks cover side-by-side comparisons and mobile course review entry.
- Test requests target localhost only; synthetic test records are not included in the deployment artifact.

Hosted deployment status is verified separately through Sites. A successful deployment does not prove real university data coverage or student adoption.

## September 26 polish verification

Added regression coverage for instructor search across submitted reviews, whitespace normalization, duplicate feature removal, calendar-aware term defaults, unrated display, and explicit validation-error typing. The 25 API assertions now also verify that duplicate creation returns the existing listing with `created: false` and HTTP 200.

Browser checks cover the review chooser, closing/reopening a draft, listing URL reloads, quick filters, and visible mobile review navigation. No domain purchase or access-policy change is included.
