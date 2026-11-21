import { accountSuites } from "@cbpupsis/account/testing";

import { session } from "../lib/auth";
import * as fixtures from "./fixtures";
import { renderApp } from "./renderApp";

// Forgot and reset password, the password change, and the idle warning, through this portal's
// own router and guards.
accountSuites({ ...fixtures, session, renderApp });
