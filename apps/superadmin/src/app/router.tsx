import { createPortalRouter } from "@cbpupsis/account";
import type { RouterHistory } from "@tanstack/react-router";

import { HomePage } from "../features/dashboard/HomePage";
import { SignInPage } from "../features/sign-in/SignInPage";
import { account } from "../lib/auth";

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createPortalRouter({
    config: account,
    signIn: SignInPage,
    dashboard: HomePage,
    history,
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
