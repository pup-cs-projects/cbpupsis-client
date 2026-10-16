import { session } from "../lib/auth";

// What the account-flow tests need to know about this portal. The test files themselves are
// the same in every app.

export const PORTAL_HEADING = "Faculty Portal";
export const ME_ROUTE = "GET /auth/faculty/me";
export const LOGOUT_ROUTE = "POST /auth/faculty/logout";
export const REFRESH_ROUTE = "POST /auth/faculty/refresh";

export const me = {
  id: "6f1c1e8e-0000-4000-8000-000000000002",
  email: "maria.santos@pup.edu.ph",
  role: "faculty",
  employee_id: "2021-00456-MN-0",
};

/** The text the dashboard shows once the account has loaded. */
export const SIGNED_IN_TEXT = new RegExp(`Signed in as ${me.email}`);

/** Start a session as the sign-in steps would, without going through them. */
export function signInDirectly() {
  session.signIn({ accessToken: "access-1", refreshToken: "refresh-1" });
}

/** The pair a refresh returns for this role. */
export const refreshedPair = {
  access_token: "access-2",
  refresh_token: "refresh-2",
  token_type: "bearer",
  role: "faculty",
  expires_in: 900,
};
