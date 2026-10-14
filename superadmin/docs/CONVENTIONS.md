# Client conventions

|                  |                                                                                                                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Last updated** | 2026-09-15                                                                                                                                                                                                                                                      |
| **Related**      | [CONTRIBUTING.md](../CONTRIBUTING.md) · [API error codes](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/tech-book/ERROR-CODES.md) · [Writing issues](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/tech-book/WRITING-ISSUES.md) |

The rules every change to `cbpupsis-client` follows. Keep this page open while building a
screen.

## Layout

```
src/
  main.tsx              providers (TanStack Query, TanStack Router) and the mount point
  app/                  router and app-wide wiring
  features/<name>/      one folder per feature: screens, components, hooks, API calls, tests
  components/ui/        shared primitives (button, field, table) once a second feature needs one
  lib/                  API client, formatting helpers, shared types
  test/                 test setup
public/                 static files served as-is
docs/                   this page
.github/                CI, PR conventions, PR and issue templates
```

`src/components/ui/`, `src/lib/`, and most features do not exist yet. Create them following this
layout rather than inventing another.

## Stack

| Concern      | Choice                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| UI           | React 19, TypeScript (strict)                                                               |
| Build        | Vite                                                                                        |
| Routing      | TanStack Router                                                                             |
| Server state | TanStack Query                                                                              |
| Styling      | Tailwind CSS 4, brand tokens in `src/index.css`                                             |
| Tests        | Vitest, Testing Library, jsdom                                                              |
| Quality      | ESLint (typescript-eslint, react-hooks, jsx-a11y), Prettier, husky, lint-staged, commitlint |
| Hosting      | S3 and CloudFront, ap-southeast-1 (SRS 2.4)                                                 |

## Product context

- **Requirements:** the [SRS](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/project-specs/SRS.md)
  in the API repo. The story registry with acceptance criteria ids is
  [US-ACS.md](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/project-specs/US-ACS.md),
  also in the API repo.
- **Users:** students (15,000+, mobile first), faculty (30 to 80), administrators, and
  superadministrators. Each role sees only the menu items it may use (FR2), but hiding a button
  is UX, never security: the API enforces every permission.
- **Team:** two frontend developers here, three backend developers on the API, and a product
  owner who owns the backlog and merges.
- **Backlog:** org project board "CBPUPSIS Client" (project 3), with the same epic numbers as the
  API board.
- **Data privacy:** student records are personal information under RA 10173. Never log them to
  the console, never put them in `localStorage`, and never commit real records or screenshots of
  them.

## UI requirements that apply to every screen

From SRS 4.3 and 5.1. A screen missing one of these is unfinished.

- **WCAG 2.1 Level AA.** Semantic elements, labels on every input, visible focus, keyboard
  navigation, alt text, color never the only signal. `eslint-plugin-jsx-a11y` catches part of
  this; the keyboard check is manual.
- **Responsive from 320px to 2560px**, portrait and landscape. Below 768px the navigation is a
  menu button and non-essential elements are removed. Touch targets are at least 44 by 44px.
- **Breadcrumbs** on every page except home, and a consistent navigation structure.
- **Loading, empty, and error states** for everything that fetches. Errors say what to do next.
- **Forms:** required fields marked with an asterisk, inline field errors, submit disabled while a
  request is in flight, input saved locally for recovery, and auto-save every 30 seconds on long
  forms.
- **Print:** a print stylesheet that hides navigation, for documents such as the Certificate of
  Registration.
- **Branding:** PUP maroon and gold through the `brand-*` color tokens only, and text no smaller
  than 12px.

## Code

- **Data flow:** API types, then the API client in `src/lib/`, then a query or mutation hook in
  the feature, then the component. Components render; they do not fetch or hold business rules.
- **Server data lives in TanStack Query**, never copied into component state. Query keys come
  from one key factory per feature, not ad-hoc arrays.
- **API types are generated from the API's OpenAPI schema**, not written by hand, once that
  pipeline exists (tracked in the setup epic).
- **The API error envelope is `{ detail, request_id, code? }`.** Branch on `code`, never on the
  wording of `detail`. Show `request_id` in error states so bug reports can include it.
- **Another user's record returns 404** from the API by design. Render it as "not found", not as a
  permission error.
- **Money** is formatted once, in a helper, as Philippine pesos
  (`Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" })`). Never do money math in
  floating point in the client; display the API's values.
- **Dates** come from the API in UTC and are displayed in `Asia/Manila`.
- **No `any`.** Model unknown data as `unknown` and narrow it. Use union types for status.
- **Styling:** Tailwind utilities and the theme tokens. No raw hex colors in components.
- **Tests** sit next to the code (`HomePage.test.tsx`) and query by role and label, the way a user
  and a screen reader find things.

## Known gaps

Each has a `type: decision` issue in the API repo. **Do not resolve one silently in code.**

| Topic            | SRS says                                                             | Today                                                          |
| ---------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| Session storage  | Secure, HttpOnly cookies with SameSite and CSRF protection (SRS 4.2) | The API returns access and refresh tokens in the response body |
| Session timeout  | 30 minutes of inactivity, with a warning 5 minutes before (FR1)      | Not implemented in the API or the client                       |
| Login identifier | Student number `YYYY-NNNNN-XX-N` or employee id (FR1)                | The API logs in by email                                       |

Until the session decision closes, keep tokens in memory only, never in `localStorage` or
`sessionStorage`.

## Verifying

```bash
npm run typecheck      # tsc
npm run lint           # ESLint, zero warnings allowed
npm run format:check   # Prettier
npm run test           # Vitest
npm run build          # the check that catches what the others miss
npm run check          # the first four together
```

Run the checks covering what you changed, then `npm run build` before a PR. In the PR, say
plainly what you ran and what you did not.

## Workflow

- **Base branch is `dev`.** Branches are `feature/<name>`, `bugfix/<name>`, `hotfix/<name>`.
  Commits and PR titles follow Conventional Commits. Maintainers squash and merge. Details in
  [CONTRIBUTING.md](../CONTRIBUTING.md).
- **No attribution trailers** (`Co-Authored-By`, "Generated with") in commits or PRs.
- **No em dashes** in anything written for this project: issues, PRs, commit messages, UI copy,
  and docs. Use a colon, a comma, or parentheses.
- **If the API does not return what a screen needs,** file a task in the API repo. Do not paper
  over a contract gap with client-side transformation.
- **Personal tooling stays personal.** Editor settings and AI assistant configuration are
  gitignored and never committed.
- The husky pre-commit hook refuses commits directly on `main` or `dev`. Branch first.
