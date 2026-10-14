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

npm ci                         # installs dependencies and the git hooks
cp .env.example .env.local     # local settings; never committed
npm run dev                    # http://localhost:3000
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

1. **Pick an issue** from the **Ready** column of the board. Assign yourself and move it to **In Progress**.
2. **Branch from an up-to-date `dev`:**

   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/login-screen
   ```

3. **Build it in small commits.** Keep `npm run test:watch` open while you work.
4. **Before pushing,** pull `dev` again, fix any conflicts on your branch, and run the checks:

   ```bash
   git pull origin dev
   npm run check && npm run build
   git push -u origin feature/login-screen
   ```

5. **Open a pull request against `dev`.** Fill in every section of the template, including
   screenshots at mobile and desktop width. Link the issue with `Closes #N`, and move the issue to **In Review**.
6. **Review.** Request review from the other frontend developer. Reply to every comment, push
   fixes as new commits, and re-request review.
7. **Merge.** When CI is green and one reviewer has approved, a maintainer **squashes and
   merges**. The PR title becomes the commit on `dev`. Delete the branch afterwards.

`dev` is released to `main` by the product owner through a PR from `dev` to `main`.

## 4. Branches and commits

| Branch           | Purpose                                                               | Example                       |
| ---------------- | --------------------------------------------------------------------- | ----------------------------- |
| `main`           | Released code. Never commit to it directly.                           |                               |
| `dev`            | Integration branch. Every PR targets it. Never commit to it directly. |                               |
| `feature/<name>` | New work                                                              | `feature/login-screen`        |
| `bugfix/<name>`  | A fix for something on `dev`                                          | `bugfix/menu-overflow-mobile` |
| `hotfix/<name>`  | An urgent fix for `main`                                              | `hotfix/blank-page-safari`    |

Names are lowercase and hyphen-separated. One issue per branch.

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

| Hook         | Checks                                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | refuses commits on `main` and `dev`; refuses a staged private key; runs `eslint --fix` and `prettier --write` on staged files |
| `commit-msg` | the message follows Conventional Commits                                                                                      |

If ESLint reports something it cannot fix, the commit stops. Fix it, `git add`, and commit again.

**Never use `git commit --no-verify`.** CI runs the same checks over the whole project, so
skipping them locally only moves the failure to your PR.

## 6. What CI checks

| Workflow             | When                                        | What                                                                              |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| `ci.yml`             | every push to `main` or `dev`, and every PR | typecheck, lint, format check, tests with coverage, production build, `npm audit` |
| `pr-conventions.yml` | every PR                                    | Conventional Commits title; branch name; PR targets `dev`                         |

The org is on the GitHub Free plan, so these checks cannot be made required. **The team rule is
that nobody merges a PR with a red check.** To read a failure: `gh run view <id> --log-failed`.

## 7. Coding standards

[docs/CONVENTIONS.md](docs/CONVENTIONS.md) holds the rules. The non-negotiable ones:

- A feature lives in `src/features/<name>/`: its screens, components, hooks, API calls, and tests.
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

Use the issue forms: **User story**, **Task**, **Bug report**, **Decision**. The full guide is
[Writing issues](https://github.com/pup-cs-projects/cbpupsis-api/blob/dev/docs/tech-book/WRITING-ISSUES.md) in cbpupsis-api. In short:

- Titles: `EP-NN: <module>` for epics, `US-N: <capability>` for stories, `Decide: <question>` for
  decisions, and a plain imperative sentence for tasks.
- Labels: one `type:`, one `area:`, one `priority:`.
- Stories describe what a user can observe and carry Given, When, Then acceptance criteria with
  ids (`AC-4.1`) registered in the API repo's `US-ACS.md`.
- Attach every story and task to its epic as a **sub-issue**.
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
- [ ] One reviewer approved and the PR is squash-merged into `dev`
- [ ] The issue is closed by the merge

## 10. Troubleshooting

| Symptom                                         | Fix                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Permission denied` on push                     | Accept the org invitation and confirm you have write access to the repo                        |
| Commit refused: "Do not commit directly to dev" | `git checkout -b feature/<name>`, then commit                                                  |
| Commit refused by commitlint                    | Rewrite the message as `type(scope): description`                                              |
| Hooks do not run at all                         | `npm run prepare`, then check `git config core.hooksPath` prints `.husky/_`                    |
| `format:check` fails on every file on Windows   | Line endings. Run `git add --renormalize .` and commit; `.gitattributes` keeps LF from then on |
| Port 3000 already in use                        | Stop the other process. The port is fixed because the API's CORS setting expects it            |
| API calls fail with a CORS error                | The API is not running, or `VITE_API_BASE_URL` in `.env.local` points somewhere else           |
| CI fails but `npm run check` passes             | `npm run build` locally; then `gh run view <id> --log-failed`                                  |

Still stuck? Comment on your issue with the exact command and output, and mention the product
owner.
