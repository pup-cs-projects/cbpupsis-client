// Test helpers for the portals. The account suites run inside each app, against its own router,
// so the shared flows are proven in every portal that mounts them.
import "@testing-library/jest-dom/vitest";

import { changePasswordSuite } from "./changePasswordSuite";
import { forgotPasswordSuite } from "./forgotPasswordSuite";
import { idleWarningSuite } from "./idleWarningSuite";
import type { PortalFixtures } from "./portal";
import { resetPasswordSuite } from "./resetPasswordSuite";

export { mockApi } from "./mockApi";
export type { PortalFixtures } from "./portal";

/** Every account-flow suite: forgot and reset password, the password change, the idle warning. */
export function accountSuites(fixtures: PortalFixtures) {
  forgotPasswordSuite(fixtures);
  resetPasswordSuite(fixtures);
  changePasswordSuite(fixtures);
  idleWarningSuite(fixtures);
}
