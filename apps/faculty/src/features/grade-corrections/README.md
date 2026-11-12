# Correction of Entry (US-FAC-002)

Faculty and admin routes are both /grade-corrections on their respective portals.
Faculty file a section/student correction with a proposed mark, reason and grading sheet.
Chair and Dean endorse at their own step; Registrar commits. Rejection requires remarks.
Finance cannot load the page or its records. Approval scope and actor separation are
enforced by the backend; the UI additionally restricts displayed actions.

The available OpenAPI lacks the final correction response schemas. As with FAC-001,
the frontend uses a typed port. Supply CorrectionCodec in each feature/dataSource.ts
when the published contract is available. Unconfigured adapters fail before HTTP;
no production fixtures or fake successful responses are installed. The filing multipart
field names follow the supplied backend issue. Approval payload encoding is delegated
to the final codec. Section/student codecs must return assigned sections and final grades.

File size and declared MIME are checked locally; only the server can validate actual
content. Window expiry, audit immutability and transactional grade/GWA changes are
backend responsibilities. The frontend does not compute correction windows or GWA.

Each portal discovers feature-owned portalRoutes.tsx modules. The identical route
registration seam is also on web-us-fac-001; the two features add different modules.
Public subpath exports avoid competing edits to the grades/UI barrel indexes.

Tests cover AC-FAC-002.1–7, all four admin roles, file refusals, retries and axe.
Run npm run typecheck, npm run lint, npm run format:check and npm run build.
Run tests in shared, UI, faculty and admin with --maxWorkers=1.
Live backend integration and end-to-end acceptance remain pending the final codec.
