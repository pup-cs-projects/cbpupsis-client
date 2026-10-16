import { ApiError, errorMessage, isThrottled } from "@cbpupsis/shared/api";

import { formatTime, useCountdown } from "./useCountdown";

/** One failed step: what happened, how long to wait if locked out, and the reference id. */
export function ErrorAlert({ error }: { error: unknown }) {
  const throttled = isThrottled(error) ? error : undefined;
  const remaining = useCountdown(throttled?.retryAt);
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
      <p>{errorMessage(error)}</p>
      {remaining !== undefined && (
        <p className="mt-1">
          {remaining > 0 ? (
            <>
              Try again in <span role="timer">{formatTime(remaining)}</span>.
            </>
          ) : (
            "You can try again now."
          )}
        </p>
      )}
      {error instanceof ApiError && error.requestId && (
        <p className="mt-1 text-sm">Reference: {error.requestId}</p>
      )}
    </div>
  );
}
