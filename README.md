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

npm ci                         # dependencies and git hooks
cp .env.example .env.local
npm run dev                    # http://localhost:3000
```

The client expects the API at `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`).
See the API repository to run it locally.

## Scripts

| Task                   | Command                                              |
| ---------------------- | ---------------------------------------------------- |
| Start the dev server   | `npm run dev`                                        |
| Typecheck              | `npm run typecheck`                                  |
| Lint                   | `npm run lint` (fix with `npm run lint:fix`)         |
| Format                 | `npm run format` (check with `npm run format:check`) |
| Test once              | `npm run test`                                       |
| Test while editing     | `npm run test:watch`                                 |
| Coverage               | `npm run test:coverage`                              |
| All checks before a PR | `npm run check && npm run build`                     |
| Production build       | `npm run build`                                      |

## Layout

```
src/
  main.tsx            providers and mount point
  app/                router and app-wide wiring
  features/<name>/    screens, components, hooks, API calls, and tests for one feature
  components/ui/      shared primitives
  lib/                API client and helpers
  test/               test setup
```

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
