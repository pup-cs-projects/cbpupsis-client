## What's New?

<!-- Describe the actual diff in a few lines, not the task. -->

## Related Issues

<!-- One line per issue this PR completes. Use "Refs #N" for partial work. -->

Closes #

## How to Verify

<!-- The screen to open, the steps to take, and what the reviewer should see. -->

1.

## Screenshots

<!-- Required for any visible change: one at 360px wide and one at desktop width. -->

| Mobile (360px) | Desktop |
| -------------- | ------- |
|                |         |

## Acceptance Criteria Covered

<!-- AC ids from cbpupsis-api docs/project-specs/US-ACS.md, or "n/a" for setup and tooling work. -->

## Accessibility

- [ ] Every interactive element is reachable and usable with the keyboard alone
- [ ] Every input has a visible label, and errors appear next to the field
- [ ] Color is never the only signal, and text contrast meets WCAG 2.1 AA
- [ ] Touch targets are at least 44 by 44 pixels
- [ ] Not applicable (no UI change)

## Risk

- [ ] Depends on an API change that is not merged yet (link it)
- [ ] Adds a `VITE_*` variable (added to `.env.example` and the deploy workflow)
- [ ] Changes routing, the API client, or shared components used by other screens
- [ ] None of the above

## Checklist

<!-- Tick a box only when it is true. An unchecked box is information for the reviewer. -->

- [ ] PR targets `dev`, and the branch is `feature/`, `bugfix/`, or `hotfix/`
- [ ] Title follows Conventional Commits, for example `feat(enrollment): add course picker`
- [ ] `npm run check` and `npm run build` pass locally
- [ ] Loading, empty, and error states are handled for every screen that fetches data
- [ ] Tests added or updated, and they fail without this change
- [ ] No secrets or real student data in code, fixtures, or screenshots
