# Faculty authentication implementation

Parent story and acceptance criteria: [pup-cs-projects/cbpupsis-api#68](https://github.com/pup-cs-projects/cbpupsis-api/issues/68).
The story remains the source of truth; its criteria are not copied here.

## Files and running locally

All application changes live in `faculty/`.

- `src/assets/`: supplied PUP seal and campus background.
- `src/features/auth/`: sign-in, factor setup, recovery codes, verification, skeletons, hooks and tests.
- `src/lib/auth-api.ts`: runtime-validated faculty API adapter.
- `src/app/router.ts`: sign-in and guarded dashboard landing route.

Run `npm ci`, copy `.env.example` to `.env.local`, set `VITE_API_BASE_URL` to the API root (including `/api/v1`), then run `npm run dev`. On Windows PowerShell, `npm.cmd` can be used explicitly.

## API integration

The current backend dev branch mounts faculty authentication at `/faculty-auth`, although the story examples use `/auth`. This client follows the implemented route mount:

- `POST /faculty-auth/login` sends `identifier`, `password`, `birthday`; reads the nested `status/data` challenge response.
- `POST /faculty-auth/mfa/enroll` uses the challenge as a Bearer token and reads the manual setup key and period from the provisioning URI.
- `POST /faculty-auth/mfa/enroll/confirm` sends `code` with the challenge Bearer token. Recovery codes are displayed only after successful confirmation.
- `POST /faculty-auth/mfa/verify` sends `challenge_token` and `code`; only a successful faculty session opens the dashboard.

Setup confirmation consumes the setup code on the backend. The user saves recovery codes, then supplies the next authenticator code before entering the dashboard. No student-data request is issued during this flow. Credentials, setup keys, recovery codes and tokens are never written to localStorage or sessionStorage. Mutations are not retried automatically and their unused cache entries are discarded.

The code countdown is advisory. Enrollment uses the server provisioning URI's period. Existing-factor sign-in uses the backend's current 30-second period because the challenge response exposes no period or server clock. Challenge expiration and lockout duration come from server responses. Local timers never grant a session or override an API rejection.

## Verification and remaining integration work

- AC-002.1 through AC-002.6: client behavior is exercised in the colocated tests using mocked API decisions.
- AC-002.7 and AC-002.8: backend integration verification remains required. Course/roster screens and an audit viewer are outside this sign-in screen change.
- The dashboard is a guarded landing shell, with an explicit empty state.
- Browser layout checks cover 320x640, 640x320, 768x1024, 1024x768, 1440x1024, 2560x1440 and 1440x2560 without horizontal overflow.
- Controls have labels, keyboard focus, 44px minimum touch targets, live error announcements and reduced-motion skeletons. The reference card's opacity and label colors are adjusted for readable text contrast. Full assistive-technology/WCAG certification remains a manual QA step.
- The backend currently uses `AUTH_MFA_INVALID` for both incorrect and expired codes. The UI offers current-code/restart guidance without inspecting server prose or identifying a failed credential. A distinct expired-code error and server timing metadata are needed for precise expiry feedback.
- Backend lockout counting, security email delivery, challenge single use, cookie flags, course ownership and append-only audit behavior cannot be proven by mocked frontend tests.
- End-to-end verification with a running faculty API and test accounts, remote CI, reviewer approval and merge to dev are still pending.

Backend source inspected: `apps/api-faculty/src/cbpupsis_api_faculty/routes.py` and `domains/faculty_auth/{router,schemas,service,security,exceptions}.py` on the API dev branch.
