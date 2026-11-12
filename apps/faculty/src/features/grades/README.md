# Faculty grading and Inc completions (US-FAC-001)

Routes: faculty `/grades`, `/sections/:sectionId/grades`, `/incompletes`; admin
`/incomplete-completions`. Pages use the existing portal dashboard layout and account
session, labelled mark fields, native modal dialogs and scrollable tables at 320px.

## Frontend behavior

- Drafts save manually and every 60 seconds while changed and valid. Late edits survive
  an in-flight autosave; the next write uses the returned version. Nothing is stored in
  browser storage. Leaving a dirty grid requires confirmation.
- Finalization confirms the lock, rechecks the deadline, saves unsaved edits first and
  passes the returned draft version. The UI becomes final only after server success.
- Locked grades are read-only; a version conflict requires an explicit reload. Validation
  errors are associated with individual students. A 404 uses the shared not-found page.
- Completion deadlines and remaining days come from the data source. The frontend never
  invents a 365-day deadline, converts an expired Inc, computes official GWA or sends notifications.
- Completion requests require a 1.00–3.00 mark and a nonempty file. Filing leaves the
  recorded Inc unchanged while awaiting Dean endorsement.
- Only the authenticated Dean sees the admin navigation entry or loads review data.
  Rejections require remarks. Decisions include the loaded version and are never retried
  automatically; conflicts require fresh details. The backend must enforce college scope.

## Backend integration is intentionally pending

The user approved building the frontend with a typed adapter while the final backend
contract is unavailable. The available OpenAPI does not contain grading/completion
schemas. `packages/shared/src/grades/faculty.ts` therefore defines stable frontend models,
the documented role-prefixed routes, and codec interfaces instead of guessing wire fields.

`createFacultyGradesApi(client, contract)` and `createIncompleteReviewApi(client, contract)`
accept the final backend codecs. Without a codec, they reject with `GRADING_NOT_CONFIGURED`
before sending a request. The pages display an unavailable message and retry. Production
does not use mock data, successful placeholder responses, legacy paths or authentication bypasses.

When the backend specification is published:

1. Regenerate the shared OpenAPI types using the repository's normal generator.
2. Implement `FacultyGradesContract` and `IncompleteReviewContract` in shared, parsing
   unknown responses and encoding the published request fields. Normalize row validation
   errors through the codec’s `normalizeError` hook as `GradeValidationError`. Never trust an unchecked JSON cast.
3. Pass the codecs to the factories in each portal's `src/lib/auth.ts`. The existing data
   source adapters already attach the current session token to every call.
4. Verify the final draft/finalization version semantics, read-only deadlines, pending
   completion projection, multipart field names, file limits and access-controlled form URLs.
5. Run the shared/faculty/admin suites and check live ownership, role and college filtering.

In-memory examples live only in `src/test/gradingFixtures.ts` and tests. These can also
be injected through each page's `dataSource` prop for a temporary local visual harness;
no fixture is imported by the production application.

## Validation

Run `npm run check` and `npm run build` from the client root. Feature tests name the
acceptance criteria, including save/finalize, Inc validation, role restrictions and axe.
Manual verification includes 320px, keyboard entry, Escape, dialog focus return and
browser contrast checks. End-to-end backend acceptance is pending the final codecs/API.
