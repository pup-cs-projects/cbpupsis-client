# CBPUPSIS Client

Web client for **CBPUPSIS**, the Cloud-Based PUP Student Information System of the
Polytechnic University of the Philippines. Students use it to manage their profile,
enrollment, schedules, grades, and payments; faculty to submit grades; administrators to run
the academic calendar, fees, users, and reports.

|                   |                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Requirements      | [SRS in cbpupsis-api](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/project-specs/SRS.md) |
| Board             | [CBPUPSIS Client](https://github.com/orgs/pup-cs-projects/projects/3)                                     |
| API               | [cbpupsis-api](https://github.com/pup-cs-projects/cbpupsis-api)                                           |
| How to contribute | [CONTRIBUTING.md](CONTRIBUTING.md)                                                                        |

## Stack

React 19 · TypeScript · Vite · TanStack Router · TanStack Query · Tailwind CSS 4 · Vitest ·
Testing Library · ESLint · Prettier · husky

## Quick start

```bash
git clone https://github.com/pup-cs-projects/cbpupsis-client.git
cd cbpupsis-client
git checkout dev

npm ci                         # every portal's dependencies, and the git hooks
cp apps/student/.env.example apps/student/.env.local
npm run dev:student            # http://localhost:3000
```

Each portal expects its API at `VITE_API_BASE_URL`, set in its own `apps/<portal>/.env.local`.
`make up` in the API repository runs the API and all four portals together.

## Scripts

| Task                   | Command                                                       |
| ---------------------- | ------------------------------------------------------------- |
| Start a portal         | `npm run dev:student` (also `faculty`, `admin`, `superadmin`) |
| Typecheck              | `npm run typecheck`                                           |
| Lint                   | `npm run lint` (fix with `npm run lint:fix`)                  |
| Format                 | `npm run format` (check with `npm run format:check`)          |
| Test once              | `npm run test`                                                |
| Test while editing     | `npm run test:watch -w apps/student`                          |
| Coverage               | `npm run test:coverage`                                       |
| All checks before a PR | `npm run check && npm run build`                              |
| Production build       | `npm run build`                                               |

## Layout

```
apps/                     one Vite app per portal, each deployed on its own
  student/                :3000
  faculty/                :3001
  admin/                  :3002
  superadmin/             :3003
    src/
      main.tsx            providers and the mount point
      app/router.tsx      the portal's router: createPortalRouter with its own screens
      features/<name>/    one folder per feature: screens, hooks, API calls, tests
      lib/                the portal's API client, session, and account config
      test/               test setup, fixtures, and the shared account suites
packages/
  shared/                 framework-free: API client, error envelope, session, password rules
  ui/                     React building blocks: buttons, fields, alerts, hooks, brand theme
  account/                the account flows every portal shares: sign-in layout, password
                          reset and change, idle sign-out, and their test suites
```

Every script at the root runs across the whole workspace. Run one package's script with
`-w`, for example `npm run test -w packages/ui`.

## Documentation

| Document                                                                                                                 | Read it for                                  |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md)                                                                               | conventions, UI requirements, and known gaps |
| [CONTRIBUTING.md](CONTRIBUTING.md)                                                                                       | setup, branches, commits, hooks, CI, reviews |
| [API error codes](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/tech-book/ERROR-CODES.md)                | the error contract the client handles        |
| [Stories and acceptance criteria](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/project-specs/US-ACS.md) | what each screen must do                     |

## Contributing

Branch from `dev`, follow Conventional Commits, and open a PR against `dev`. The full process,
including the definition of done, is in [CONTRIBUTING.md](CONTRIBUTING.md).
