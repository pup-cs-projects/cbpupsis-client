# Student schedule and Google Calendar

US-STU-005 connects the existing schedule controls to the authenticated API. No Google
SDK, frontend client secret, mock mode, or extra dependency is required.

## API contract and deployment dependency

`packages/shared/src/schedule/student.ts` maps the direct snake_case calendar responses
into typed UI fields and discards unspecified fields. Authorization URLs must point to
Google's HTTPS consent endpoint. Calendar status contains no Google IDs or credentials.

The default paths are `/api/v1/student/schedule` and
`/api/v1/student/schedule/google-calendar` (authorization, callback, sync and DELETE).
An explicit `VITE_STUDENT_SCHEDULE_API_PATH=/students/me/schedule` setting supports
the existing backend before its #147 path migration. Schedule reads, PDF/ICS exports
and all Calendar operations use the same configured namespace. Failed requests never
trigger automatic fallback or a second OAuth callback submission. The field contracts
remain `ConnectionRead`, `AuthorizationRead`, `TermSelection`,
`CalendarTargetRead`, and `OAuthCallback`.

For the current local backend, use these public settings in
`apps/student/.env.development.local` (ignored by Git):

```dotenv
VITE_API_BASE_URL=http://localhost:8001/api/v1
VITE_STUDENT_SCHEDULE_API_PATH=/students/me/schedule
```

Restart Vite after changing settings. Once the backend exposes the migrated routes,
change the schedule setting to `/student/schedule`. For a standalone combined API,
use its URL (usually `http://localhost:8000/api/v1`) instead. Development-only local
settings are not loaded by tests or production builds. Deployments using the old
backend must explicitly supply the older schedule namespace when building the client.
Google Calendar setup/verification from #157 and a running sync worker are still required.

The backend and Google OAuth configuration must use the frontend callback URL, for example
`http://localhost:3000/calendar/google/callback`. The backend integration flag, OAuth
credentials, encryption key and worker configuration remain backend concerns. The worker
must run for queued sync and revocation to complete.

## Optional frontend-only connection attempt

Set `VITE_GOOGLE_CALENDAR_ALLOW_CONNECT_ATTEMPT=true` in
`apps/student/.env.development.local` and restart Vite to make Connect clickable
when the server reports `enabled: false`. Both schedule entry points use the same
controller permission. Loading, active requests, existing connections and pending
revocation retain their normal guards. The default is false, preserving the normal
server-disabled behavior in deployments.

This option only permits an authorization request. It does not enable the backend,
invent a Google sign-in URL or mark a connection successful. The frontend still
uses the API-returned consent URL and displays any server rejection. Actual sync
and linked-term controls remain governed by the authoritative backend status.

## Behavior

- Schedule/PDF/ICS requests are independent of the optional Calendar status and mutations.
- Connect opens the backend's validated Google consent URL unchanged. Its
  `prompt=consent select_account` asks Google to show account selection and consent;
  students sign in on Google's page when needed. The selected Google account, rather
  than the portal email address, owns the connected calendar. Google credentials are
  never collected by the student portal.
- Authorization sends the current raw year/semester selectors, or `{}` for the configured
  current term when the schedule is empty. The returned consent URL is not cached or rendered.
- Successful callback automatically queues the first term on the backend. The schedule
  shows this pending first sync after returning from Google; no extra Sync click or
  duplicate frontend sync POST is needed. The worker completes delivery. Manual sync
  remains available for later refreshes and additional terms.
- The callback reads the original history query, URL-decodes once, rejects missing or
  ambiguous values, replaces the URL, and forwards state/code through a single promise.
  Rerenders and StrictMode effect replay never resubmit it. Failure requires fresh consent;
  no callback retry button or browser-storage credential persistence is used. Its 35-second
  request deadline allows the backend's 25-second provider timeout to return a 503 response.
- The existing app startup restores the same SIS session from its refresh cookie before
  mounting routes. A missing session shows a recovery message without forwarding the code.
- Current and linked terms appear as choices. Other terms use academic year and semester
  selectors because the documented API has no student term-catalog endpoint. The backend
  validates that a selected term has a schedule.
- The API accepts one term per sync POST, so batches are sequential and bounded to ten
  unique pinned terms. A partial failure reports confirmed queues and keeps only the
  unfinished selection for a later attempt. No automatic mutation retries occur.
- Unchecking a term skips a manual sync; it does not unpin it or disable background sync.
  No individual unpin operation is invented. Backend reconnect mappings may be retained.
- Queued responses are acknowledgements, not delivery confirmation. Status refresh is
  explicit so background polling cannot keep an idle SIS session alive. Times use Manila.
- Disconnect requires a keyboard-accessible confirmation. Google calendars/events remain.
  Pending revocation disables reconnect; status refresh shows when it is complete.
- Public errors use safe messages. OAuth codes, state, provider payloads and Google IDs are
  never displayed or logged. The student entry document uses a no-referrer policy.

## Verification

`SchedulePage.test.tsx` and `GoogleCalendarCallbackPage.test.tsx` name the covered ACs.
`packages/shared/src/schedule/student.test.ts` checks paths, request bodies, mapping,
disabled defaults, URL validation, queued responses and errors. Existing schedule mapping
and add/drop tests use the migrated schedule path.

Run `npm run check` and `npm run build` from the client root. Browser verification checks
320px layouts, consent/callback navigation, downloads, native dialog focus and axe contrast.
Automated consent uses intercepted test responses; it does not connect a real Google account.
