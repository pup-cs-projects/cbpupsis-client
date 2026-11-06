# Admin enrollment review

The page uses the signed-in `me.position`; it has no role switcher or role fallback.
The backend must enforce reviewer scope and decisions, regardless of button visibility.

## Backend boundary

Wire types live in `@cbpupsis/shared/enrollment` (`packages/shared/src/enrollment/admin.ts`).
They follow the OpenAPI required/default semantics, including optional nullable fields.
Verified snapshots: API `fr003` at `918b439`, add/drop PR #211 at `fb0e421`, and waiver
PR #213 at `c0b5c26`. The open PR schemas may change before backend integration.
The waiver schema currently defines state and condition as strings; the mapper validates
the supported values rather than assuming every string is a known state.

Implement an authenticated `EnrollmentReviewTransport`, then supply
`createEnrollmentReviewDataSource(transport)` at the exported integration point in
`dataSource.ts`. Validate network responses in that transport. Both mock and real responses
pass through `toEnrollmentRequest`; submissions use the category-specific wire bodies.
Only add/drop sends a version, and only waivers send a VPAA reference.

Waivers return `{ items, total, limit, offset }`. The current endpoint has no search/filter
parameters, so the adapter follows every page, checks `total`, and then enables client-side
search, filtering and sorting across the complete scoped list. Cancellation is propagated
between pages. A changing or incomplete page sequence produces a retryable load error.
If server-side search is added, this strategy can be replaced without changing wire types.

Decimal unit strings stay strings. Overloads show requested units without invented courses
or a current load. Waivers show student and section IDs without fabricated names or titles.
The dialog displays the available last-decision fields, not a synthetic timeline.

## Development data and verification

When no backend source is configured, development uses 18 fictional wire records. Local
decisions reset on reload. The local-only explanation appears only for mock sources.
Production includes no fixtures and shows an unavailable state until a real source is supplied.

`EnrollmentRequestsPage.test.tsx` covers roles, filters, validation, known error codes,
row feedback, empty/loading/error states, mock wording, keyboard tabs, and axe structure.
`reviewMapper.test.ts` covers field mapping, category-specific bodies and waiver pagination.
Browser checks cover native modal behavior, responsive layouts and contrast.
