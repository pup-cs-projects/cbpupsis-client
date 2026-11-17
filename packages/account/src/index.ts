// The account flows every portal shares. A portal builds its router with createPortalRouter,
// passing its config, its sign-in screen, and its dashboard.
export type { AccountConfig } from "./context";
export { AuthShell } from "./layout/AuthShell";
export { signInStyles, submitButtonClass } from "./layout/signInStyles";
export { createPortalRouter, type PortalRouterOptions, type SignInSearch } from "./router";
export { SignOutButton } from "./session/SignOutButton";
export { useSignInNotice } from "./session/useSignInNotice";
export { useSignOut } from "./session/useSignOut";
