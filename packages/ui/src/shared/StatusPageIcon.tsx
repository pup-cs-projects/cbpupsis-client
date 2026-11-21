import type { ReactNode } from "react";

/** Decorative status symbols. The heading carries their meaning. */
export function StatusPageIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="size-full"
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
