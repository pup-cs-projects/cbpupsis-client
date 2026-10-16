// What differs between the four portals' account screens. Everything else in the account
// flows (AuthShell, the password pages, the idle warning) is the same file in every app.
export const PORTAL = {
  name: "Admin Portal",
  pageClass: "admin-page",
} as const;

/** How long a success state shows before the redirect it announces. */
export const CONFIRMATION_DELAY_MS = 1200;
