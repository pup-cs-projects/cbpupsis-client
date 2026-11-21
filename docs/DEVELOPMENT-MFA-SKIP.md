# Temporary development MFA skip

There is deliberately **no browser/Vite MFA bypass flag**. The API alone controls
this temporary mode. On the Admin and Faculty **API processes**, set:

```dotenv
ENVIRONMENT=development
DEVELOPMENT_MFA_SKIP=true
```

Restart both APIs, then use the normal Admin/Faculty login pages with valid
credentials. When the API returns tokens directly, the client starts its normal
session and follows the existing account/password-change navigation. When the
API returns a challenge, the existing MFA screens still apply. Superadmin and
Student flows are unchanged. The client cannot authorize skipping MFA.

The switch defaults off, and the API refuses it in staging/production. Use only
on an isolated development stack with synthetic accounts/data. For full server
guardrails/audit details, see the API's `docs/tech-book/DEVELOPMENT-MFA-SKIP.md`.

To restore normal MFA, unset the switch or set it to `false`, restart all API
processes, and sign in again. Previously skipped access/refresh tokens are
rejected while disabled. Existing authenticator enrollments are preserved.
