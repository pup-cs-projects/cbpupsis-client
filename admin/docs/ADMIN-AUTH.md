# Administrative authentication

Frontend delivery for pup-cs-projects/cbpupsis-api#69, AC-003.1 through AC-003.8.
The parent story remains the source of acceptance criteria.

## Files and visual reference

All implementation is inside `admin/`. Assets are in `src/assets/`; the faculty
client provided the campus background, seal, and layout reference. No design image
was available in this chat, so exact matching to that image remains unverified.
The feature lives in `src/features/auth/`; the HTTP boundary is `src/lib/auth-api.ts`.

## Integration status: contract confirmation required

The supplied story confirms `/auth/login`, `/auth/mfa/verify`, the error codes,
`mfa_required`, `challenge_token`, `access_token`, `role`, and
`retry_after_seconds`. It does not provide a complete OpenAPI schema. The adapter
uses the following explicit provisional contract. Backend integration is blocked
until these fields and endpoints are confirmed; no successful login or admin
permissions are fabricated when they are missing.

| Request                                 | Expected response / behavior                                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST /auth/login                        | `{ identifier, password }`; response includes `mfa_required: true`, `mfa_enrolled`, `challenge_token`, `expires_in`, `methods: ["totp", "webauthn"]`; must not include an access token |
| POST /auth/mfa/verify                   | `{ challenge_token, code }` or `{ challenge_token, assertion }`; response has `access_token`, `expires_in`, `role: "admin"`, `position`, `permissions`                                 |
| POST /auth/mfa/enroll                   | Challenge bearer authorization; one-time `provisioning_uri`, `account_name`, `issuer`                                                                                                  |
| POST /auth/mfa/enroll/confirm           | Challenge bearer authorization and `{ code }`; nonempty `recovery_codes`; verification still required before dashboard                                                                 |
| POST /auth/mfa/webauthn/options         | `{ challenge_token }`; `public_key` in browser WebAuthn JSON format                                                                                                                    |
| GET /admin/students?page=1&page_size=25 | Admin bearer authorization; `{ items: [] }`; requires `students:read`                                                                                                                  |
| GET /admin/audit?page=1&page_size=25    | Admin bearer authorization; `{ items: [] }`; requires `audit:read`                                                                                                                     |

Responses are top-level JSON, matching the story's examples. Positions are
`Chairperson`, `Dean`, and `Registrar`. Their data scope must be resolved by the
API. Permission names and list endpoints above also require backend confirmation.
The student and audit screens are navigation shells with loading, empty, and
error handling, not full record-management screens. The ledger has no delete UI.
A secure one-time enrollment provisioning mechanism is necessary; an existing
stored factor secret must never be exposed by a read endpoint.

## Security behavior

- Credentials never create a session. A challenge grants access only to factor
  setup and verification. A session requires an Admin role and valid position.
- Tokens stay in the Query cache in memory. Sensitive mutations have zero cache
  retention after unmount, automatic retries are disabled, and fetch uses no-store.
- Lockout countdown uses the server's retry duration. There is no local attempt
  counter or client decision to unlock an account. Missing timing keeps retries
  disabled and tells the user to contact ICTO.
- Navigation mirrors API permissions. Each API endpoint must independently enforce
  role and record scope; a 404 never explains another department's ownership.
- The screen-lock control clears local session state. It is not server logout;
  server logout/revocation is an unresolved API contract.
- WebAuthn requires HTTPS (or localhost) and browser JSON credential support;
  cancellation and unsupported browsers show actionable errors.
- HttpOnly/Secure/SameSite cookies, CSRF enforcement, audit atomicity and
  immutability, failure counters, and security notices must be verified against
  the API. A frontend cannot establish those guarantees.

## Validation and remaining release checks

Automated tests cover challenge-only sign-in, no premature token acceptance,
Admin role/position validation, enrollment restriction, failure and lockout
states, labeled validation, skeletons, navigation permissions, and scope-safe
not-found responses. Run `npm run test`, `npm run typecheck`, `npm run lint`,
and `npm run build` from this directory.

Before merge, confirm the contract above, exercise real hardware-key and TOTP
sign-in, verify enrollment and recovery codes against the backend, audit one
administrative action, verify cookies and notices, and conduct full WCAG AA
screen-reader and contrast checks across every state. The current tests use API
fixtures, not a running backend. CI and a maintainer review/merge into `dev`
remain outstanding. No merge or remote publication was performed.

## Local visual checks

The sign-in screen was inspected at 320x640 and 1440x1000. DOM layout checks
found no horizontal overflow at 320x640, 360x800, 768x1024, 844x390,
1024x768, 1440x1000, and 2560x1440. Inline required-field errors were also
checked in the browser. These checks are not a full WCAG conformance audit.
