# Contributing to cbpupsis-client

This guide is for the frontend team of CBPUPSIS. Read it once, end to end, before your first
pull request. The backend team has its own guide in
[cbpupsis-api](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/CONTRIBUTING.md).

| Who                       | Owns                                                           |
| ------------------------- | -------------------------------------------------------------- |
| Frontend developers (2)   | Screens, components, client state, accessibility, client tests |
| Backend developers (3)    | The API, in `cbpupsis-api`                                     |
| Product owner (@JpCurada) | Backlog, priorities, final review, merges to `main`            |

Work is tracked on the [CBPUPSIS Client board](https://github.com/orgs/pup-cs-projects/projects/3).

## Contents

1. [Prerequisites](#1-prerequisites)
2. [First-time setup](#2-first-time-setup)
3. [Daily workflow](#3-daily-workflow)
4. [Branches and commits](#4-branches-and-commits)
5. [What the hooks check](#5-what-the-hooks-check)
6. [What CI checks](#6-what-ci-checks)
7. [Coding standards](#7-coding-standards)
8. [Writing issues](#8-writing-issues)
9. [Definition of ready and done](#9-definition-of-ready-and-done)
10. [Troubleshooting](#10-troubleshooting)

## 1. Prerequisites

| Tool               | Version                                     | Check            |
| ------------------ | ------------------------------------------- | ---------------- |
| Git                | 2.40 or newer                               | `git --version`  |
| Node.js            | 22 (see `.nvmrc`)                           | `node --version` |
| npm                | 10 or newer                                 | `npm --version`  |
| VS Code extensions | ESLint, Prettier, Tailwind CSS IntelliSense |                  |

To work against real data you also need the API running locally. Follow the setup in
[cbpupsis-api](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/CONTRIBUTING.md#2-first-time-setup).

**Windows:** use Git Bash for the commands below.

## 2. First-time setup

```bash
git clone https://github.com/pup-cs-projects/cbpupsis-client.git
cd cbpupsis-client
git checkout dev

npm ci                         # installs every portal's dependencies and the git hooks
cp apps/student/.env.example apps/student/.env.local   # local settings; never committed
npm run dev:student            # http://localhost:3000
```

`npm ci` runs `husky` through the `prepare` script, which installs the pre-commit and
commit-msg hooks. If you ever install with `HUSKY=0`, run `npm run prepare` afterwards.

Prove the toolchain works before changing anything:

```bash
npm run check    # typecheck, lint, format check, tests
npm run build
```

Both must pass. If they do not, open an issue with the output.

Set up your editor to format on save with Prettier and to show ESLint findings. The repository
settings (`.editorconfig`, `.prettierrc.json`, `eslint.config.js`) are the source of truth.

## 3. Daily workflow

Work flows through one branch per functional requirement (FR) and one branch per user story:

```
dev
 └── fr003                      (FR-003 Enrollment)
      ├── web-us-enrl-001       (US-ENRL-001, frontend)
      └── web-us-enrl-002       (US-ENRL-002, frontend)
```

Every issue says its branch and where to merge it, in the **In short** box at the top.

1. **Pick an issue** from the **Ready** column of the board. Assign yourself and move it to **In Progress**.
2. **Branch from an up-to-date FR branch.** The issue tells you which one. For US-ENRL-001 under FR-003:

   ```bash
   git fetch origin
   git checkout fr003
   git pull origin fr003
   git checkout -b web-us-enrl-001
   ```

   If the FR branch does not exist yet, the product owner creates it from `dev` first.
   All `[WEB]` tasks of one story are built on the same story branch.

3. **Build it in small commits.** Keep `npm run test:watch -w apps/<portal>` open while you work.
4. **Before pushing,** pull the FR branch again, fix any conflicts on your branch, and run the checks:

   ```bash
   git pull origin fr003
   npm run check && npm run build
   git push -u origin web-us-enrl-001
   ```

5. **Open a pull request against the FR branch** (`fr003`), not `dev`. Fill in every section of
   the template, including screenshots at mobile and desktop width. List every task it finishes
   with `Closes #N`, and move the issues to **In Review**.
6. **Review.** Request review from the other frontend developer. Reply to every comment, push
   fixes as new commits, and re-request review.
7. **Merge.** When CI is green and one reviewer has approved, a maintainer **squashes and
   merges** into the FR branch. Close the issues by hand (GitHub only closes them automatically on
   the default branch). Delete the story branch afterwards.
8. **Finish the FR.** When every story of the FR is merged and tested on its FR branch, the product
   owner opens a PR from `fr003` to `dev` and merges it with a **merge commit**.

**Fixes after testing.** A problem found while testing an FR branch or `dev` gets a short-lived
branch named by what it changes: `bugfix/<name>`, `style/<name>`, or `docs/<name>`. Branch from the
branch you tested (the FR branch or `dev`) and open the PR back into it.

### Releasing

Releases move `dev` -> `staging` -> `main`, each step a pull request merged by the product owner.
A merge into `staging` deploys the staging portals, and a merge into `main` deploys production
(see `deploy.yml` below).

1. Open a PR from `dev` to `staging`. Merging it deploys staging.
2. Check the release on the staging portals.
3. Open a PR from `staging` to `main`. Merging it deploys production.

Use a **merge commit**, not a squash, for `dev` -> `staging` and `staging` -> `main`, so the
three branches keep the same history and the next release PR shows only what is new.

An urgent fix may go `hotfix/<name>` -> `main` directly. Afterwards open a PR from `main` back
into `staging` and from `staging` into `dev`, so the fix is not lost by the next release.

Release the API first when a release needs both: a portal that calls an endpoint the API does
not serve yet breaks in front of users.

## 4. Branches and commits

| Branch                  | Purpose                                                                                                | Example                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| `main`                  | Production. A merge deploys it. Never commit to it directly.                                           |                               |
| `staging`               | The release candidate. A merge deploys staging. Never commit to it directly.                           |                               |
| `dev`                   | Integration branch. Receives finished FR branches and fixes. Never commit to it directly.              |                               |
| `fr00N`                 | One per functional requirement, from `dev`. Story branches merge into it. Never commit to it directly. | `fr003`                       |
| `web-us-<module>-<nnn>` | One per user story (all its `[WEB]` tasks), from its FR branch, merged back into it                    | `web-us-enrl-001`             |
| `web-fr00N-<name>`      | A `[WEB]` task that belongs to an FR but to no story, from that FR branch                              | `web-fr001-sign-in-errors`    |
| `bugfix/<name>`         | A fix found while testing, into the branch it was found on                                             | `bugfix/menu-overflow-mobile` |
| `style/<name>`          | A formatting or visual polish fix found while testing                                                  | `style/enrollment-spacing`    |
| `docs/<name>`           | A documentation change                                                                                 | `docs/branch-workflow`        |
| `hotfix/<name>`         | An urgent fix for `main`                                                                               | `hotfix/blank-page-safari`    |

The FR number is the story's parent FR issue: FR-001 is `fr001`, FR-003 is `fr003`. The story
part is the story id in lowercase: US-ENRL-001 is `us-enrl-001`. The API repository uses the
same names with `api-` instead of `web-`, so both halves of a story are easy to match.

| Branch                        | Branch from            | PR into                 | Merge                              |
| ----------------------------- | ---------------------- | ----------------------- | ---------------------------------- |
| `fr00N`                       | `dev`                  | `dev`                   | merge commit, by the product owner |
| `web-us-...`, `web-fr00N-...` | its FR branch          | the same FR branch      | squash                             |
| `bugfix/`, `style/`, `docs/`  | the FR branch or `dev` | the branch it came from | squash                             |
| `hotfix/`                     | `main`                 | `main`                  | see Releasing                      |

Names are lowercase and hyphen-separated. Do not use `feature/` or `refactor/` branches.

Commit messages and PR titles use **Conventional Commits**:

```
<type>(<scope>): <description>
```

| Type       | Use for                                                   |
| ---------- | --------------------------------------------------------- |
| `feat`     | a new feature                                             |
| `fix`      | a bug fix                                                 |
| `docs`     | documentation only                                        |
| `style`    | formatting only, no behavior change                       |
| `refactor` | restructuring that neither fixes a bug nor adds a feature |
| `perf`     | a performance improvement                                 |
| `test`     | adding or changing tests                                  |
| `chore`    | tooling, dependencies, maintenance                        |

The description is imperative, lowercase, with no trailing period, and under about 72
characters: `feat(enrollment): add course selection table`. The scope is the feature or area,
one lowercase word.

Do not add `Co-Authored-By` or other attribution trailers.

## 5. What the hooks check

Installed by `npm ci` (husky), configured in `.husky/`, `package.json` (`lint-staged`), and
`commitlint.config.js`.

| Hook         | Checks                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | refuses commits on `main`, `staging`, and `dev`; refuses a staged private key; runs `eslint --fix` and `prettier --write` on staged files |
| `commit-msg` | the message follows Conventional Commits                                                                                                  |

If ESLint reports something it cannot fix, the commit stops. Fix it, `git add`, and commit again.

**Never use `git commit --no-verify`.** CI runs the same checks over the whole project, so
skipping them locally only moves the failure to your PR.

## 6. What CI checks

| Workflow             | When                                                                     | What                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`             | every push to `dev`, every PR, and as the first stage of every deploy    | typecheck, lint, format check, tests with coverage, production build, `npm audit`                                                                                |
| `deploy.yml`         | every push to `staging` (deploys staging) or `main` (deploys production) | CI; builds the student, faculty, and admin portals against `/api/v1` on their own domain; uploads each to its bucket; refreshes the CDN; smoke-tests each portal |
| `pr-conventions.yml` | every PR                                                                 | Conventional Commits title; branch name; base branch (story -> FR branch -> `dev`, fixes back into their branch, releases `dev` -> `staging` -> `main`)          |

A deploy that fails shows as a red run on the `staging` or `main` branch. The infrastructure it
deploys to is defined in `cbpupsis-infra`. The superadmin portal is not deployed yet.

The org is on the GitHub Free plan, so these checks cannot be made required. **The team rule is
that nobody merges a PR with a red check.** To read a failure: `gh run view <id> --log-failed`.

## 7. Coding standards

[docs/CONVENTIONS.md](docs/CONVENTIONS.md) holds the rules. The non-negotiable ones:

- A feature lives in `apps/<portal>/src/features/<name>/`: its screens, components, hooks, API
  calls, and tests. Code a second portal needs moves to `packages/`: framework-free code to
  `shared`, React building blocks to `ui`, and whole account screens to `account`.
- Components render. Fetching happens in TanStack Query hooks; server data is never copied into
  component state.
- Every screen that fetches has a loading, an empty, and an error state.
- Accessibility (WCAG 2.1 AA): semantic HTML, labeled inputs, keyboard access, visible focus,
  44px touch targets. Check each screen with the keyboard alone before opening the PR.
- Responsive from 320px wide. Check at 360px and at desktop width.
- No `any`. No raw hex colors; use the `brand-*` tokens.
- Branch on the API error `code`, never on the `detail` text.
- Tokens and student data never go in `localStorage`, `sessionStorage`, or the console.

**When the API does not give a screen what it needs,** file a task in `cbpupsis-api` and link it.
Do not reshape or guess data in the client to hide the gap.

## 8. Writing issues

Stories live in cbpupsis-api; this repository holds their `[WEB]` tasks. The full guide is
[Writing issues](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/tech-book/WRITING-ISSUES.md) in cbpupsis-api. In short:

- Titles: `[WEB] US-<MODULE>-<NNN>: <what the screen does>` for frontend tasks, and
  `Chore: <verb> <thing>` for setup and cleanup work. There are no decision issues: pick the
  answer and write it into the task.
- Every issue starts with an **In short** box: one sentence, who builds it, the sprint, what to
  finish first, and the branch with where it merges, for example
  `` **Branch:** `web-us-enrl-001` from `fr003` · **Merge into:** `fr003` ``.
- Labels: one `type:`, one `module:`, and one MoSCoW label (`must-have`, `should-have`,
  `could-have`, `wont-have`).
- Every `[WEB]` task has a **Mockups** section with the Figma screens it builds.
- Attach every task to its story in cbpupsis-api as a **sub-issue**.
- Bug reports include a screenshot and the browser. Remove real student data first.
- Write plainly. Do not use em dashes.

## 9. Definition of ready and done

**Ready to start** when the issue has:

- [ ] A parent epic, and `type:`, `area:`, and `priority:` labels
- [ ] Acceptance criteria that can fail
- [ ] An SRS reference
- [ ] The API endpoints it needs, either merged or with a linked API issue
- [ ] No open blocker (no `status: blocked`)

**Done** when:

- [ ] Each acceptance criterion is covered by a test or a written manual check in the PR
- [ ] Loading, empty, and error states exist
- [ ] Keyboard and 360px checks pass, with screenshots in the PR
- [ ] CI is green
- [ ] One reviewer approved and the PR is squash-merged into its FR branch
- [ ] The issue is closed after the merge

## 10. Troubleshooting

| Symptom                                                                | Fix                                                                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Permission denied` on push                                            | Accept the org invitation and confirm you have write access to the repo                                    |
| Commit refused: "Do not commit directly to dev" (or `staging`, `main`) | You are on `dev`, `staging`, `main`, or an FR branch. `git checkout -b web-us-<module>-<nnn>`, then commit |
| Commit refused by commitlint                                           | Rewrite the message as `type(scope): description`                                                          |
| Hooks do not run at all                                                | `npm run prepare`, then check `git config core.hooksPath` prints `.husky/_`                                |
| `format:check` fails on every file on Windows                          | Line endings. Run `git add --renormalize .` and commit; `.gitattributes` keeps LF from then on             |
| Port 3000 already in use                                               | Stop the other process. The port is fixed because the API's CORS setting expects it                        |
| API calls fail with a CORS error                                       | The API is not running, or `VITE_API_BASE_URL` in `.env.local` points somewhere else                       |
| CI fails but `npm run check` passes                                    | `npm run build` locally; then `gh run view <id> --log-failed`                                              |

Still stuck? Comment on your issue with the exact command and output, and mention the product
owner.
