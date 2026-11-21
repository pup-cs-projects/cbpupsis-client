// The account flows every portal shares. A portal builds its router with createPortalRouter,
// passing its config, its sign-in screen, and its dashboard.
export type { AccountConfig } from "./context";
export { AuthShell } from "./layout/AuthShell";
export { createPortalRouter, type PortalRouterOptions, type SignInSearch } from "./router";
export { useSignOut } from "./session/useSignOut";
