import type { ReactNode } from "react";

/** Matches the student sidebar's avatar, name, email, and sign-out arrangement. */
export function DashboardProfileCard({
  expanded,
  name,
  email,
  loading = false,
  error = false,
  onRetry,
  signOut,
}: {
  expanded: boolean;
  name: string;
  email?: string;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  signOut: ReactNode;
}) {
  return (
    <div className={"flex items-center " + (expanded ? "gap-3" : "flex-col gap-2")}>
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white"
        aria-hidden="true"
      >
        <svg
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          focusable="false"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      {expanded ? (
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-xs leading-tight font-semibold text-white uppercase"
            title={name}
          >
            {name}
          </p>
          {email && (
            <p className="truncate text-xs leading-tight text-white/80" title={email}>
              {email}
            </p>
          )}
          {loading && (
            <p role="status" className="sr-only">
              Loading your profile
            </p>
          )}
          {error && (
            <button
              type="button"
              onClick={onRetry}
              className="focus-visible:outline-brand-gold! min-h-11 text-left text-xs text-white underline underline-offset-2"
            >
              Retry profile
            </button>
          )}
        </div>
      ) : (
        <span className="sr-only">
          {name}
          {email ? ", " + email : ""}
        </span>
      )}
      {signOut}
    </div>
  );
}
