# Admin enrollment review

The page uses the signed-in `me.position`; it has no role switcher or role fallback.
The backend must enforce reviewer scope and decisions, regardless of button visibility.

## Backend boundary

Wire types live in `@cbpupsis/shared/enrollment` (`packages/shared/src/enrollment/admin.ts`).
They follow the OpenAPI required/default semantics, including optional nullable fields.
Verified snapshots: API `fr003` at `918b439`, add/drop PR #211 at `bef214e`, and waiver
PR #213 at `b40a180`. The open PR schemas may change before they merge.
The waiver schema currently defines state and condition as strings; the mapper validates
the supported values rather than assuming every string is a known state.

`createAdminEnrollmentApi` in the same file owns the six endpoints and validates every
response. `reviewTransport.ts` runs each call through `session.authorized`, so an expired
access token refreshes and retries once, and `dataSource.ts` exports the resulting source.
Both mock and real responses pass through `toEnrollmentRequest`; submissions use the
category-specific wire bodies. Only add/drop sends a version, and only waivers send a VPAA
reference.

Failures arrive as `ApiError`, with the API's `code` when it sent one. Branch on `code`, with
one exception: a 403 has no single code (none for a missing permission on add/drop and
overload, `PERMISSION_DENIED` on waivers), so `reviewErrors.ts` branches on the status.
`REQUEST_CONCURRENCY_CONFLICT` means the row changed under a stale `version`: the list reloads
and the reviewer decides again.

Waivers return `{ items, total, limit, offset }`. The current endpoint has no search/filter
parameters, so the adapter follows every page, checks `total`, and then enables client-side
search, filtering and sorting across the complete scoped list. Cancellation is propagated
between pages. A changing or incomplete page sequence produces a retryable load error.
If server-side search is added, this strategy can be replaced without changing wire types.

Decimal unit strings stay strings. Overloads show requested units without invented courses
or a current load. Waivers show student and section IDs without fabricated names or titles.
The dialog displays the available last-decision fields, not a synthetic timeline.

## Development data and verification

The page always calls the API at `VITE_API_BASE_URL`, in development too. A failed call shows
the error state with a retry; it never falls back to mock data.

To work without an API, set this in `apps/admin/.env.local` and restart the dev server:

```bash
VITE_ENROLLMENT_REQUESTS_MOCK=true
```

Development then uses 18 fictional wire records. Local decisions reset on reload. The
local-only explanation appears only for mock sources. The flag does nothing in a production
build: `import.meta.env.DEV` is false there, so the fixtures are left out of the bundle.

`EnrollmentRequestsPage.test.tsx` covers roles, filters, validation, known error codes,
row feedback, empty/loading/error states, mock wording, keyboard tabs, and axe structure.
`reviewMapper.test.ts` covers field mapping, category-specific bodies and waiver pagination.
`reviewTransport.test.ts` covers the real source: token refresh, error codes, and pagination.
`reviewAccess.test.tsx` covers the source selection and which positions get the nav link.
The endpoint URLs, methods, bodies and parsers are tested in
`packages/shared/src/enrollment/admin.test.ts`.
Browser checks cover native modal behavior, responsive layouts and contrast.
