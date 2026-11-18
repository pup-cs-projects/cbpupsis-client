import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  signout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="m10 17-5-5 5-5M5 12h11" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  book: (
    <>
      <path d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v15" />
      <path d="M5 8h4m6 0h4M5 12h4m6 0h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3H3m14-17a3 3 0 0 1 0 6m1 4a5 5 0 0 1 4 5v2h-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 15h3" />
    </>
  ),
  briefcase: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V3h8v4M12 7v14" />
    </>
  ),
  home: (
    <>
      <path d="m3 10 9-7 9 7v11H3V10" />
      <path d="M9 21V12h6v9" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7L22 7" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="m9 3 1-1h4l1 3 3 1 3-1 2 4-2 3 1 3-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-3-1-3 2-4 3 1 3-1z" />
    </>
  ),
  announcement: (
    <>
      <path d="M3 10v5h4l10 5V5L7 10H3m4 5 2 6h3m8-11 2-2m-2 7 2 2" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="3" width="18" height="7" rx="1" />
      <rect x="3" y="14" width="18" height="7" rx="1" />
      <path d="M7 6h.01M7 17h.01" />
    </>
  ),
  activity: <path d="M2 12h5l3-8 4 16 3-8h5" />,
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0" />
    </>
  ),
  cloud: <path d="M6 19a5 5 0 0 1-1-10 7 7 0 0 1 14 1 4.5 4.5 0 0 1 0 9H6" />,
};

/** Decorative icons: the adjacent text or button label provides the accessible name. */
export function DashboardIcon({
  name,
  className = "size-5",
}: {
  name: keyof typeof paths;
  className?: string;
}) {
  return (
    <svg
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
