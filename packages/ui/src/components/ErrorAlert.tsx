import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import type { ReactNode } from "react";

/** A failed request: what happened and what to do, then the reference for a bug report. */
export function ErrorAlert({ error, children }: { error: unknown; children?: ReactNode }) {
  return (
    <div className="auth-error" role="alert">
      <p>{errorMessage(error)}</p>
      {children}
      {error instanceof ApiError && error.requestId && (
        <p className="request-id">Reference: {error.requestId}</p>
      )}
    </div>
  );
}
