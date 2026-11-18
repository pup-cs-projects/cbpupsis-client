import { AuthShell } from "@cbpupsis/account";
import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import { useQuery } from "@tanstack/react-query";

import { certificateApi } from "../../lib/auth";
import { certificateStatusLabel, issuedOn, termName } from "../enrollment/certificateDisplay";

/** Why a check failed, in words (issue #43): no match, too many checks, or anything else. */
function verifyErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return "No certificate matches this code.";
  }
  if (error instanceof ApiError && error.status === 429) {
    return "Too many checks. Try again in a minute.";
  }
  if (error instanceof ApiError && error.status === 503) {
    return "Certificates cannot be checked right now. Try again in 30 seconds.";
  }
  return errorMessage(error);
}

/**
 * US-ENRL-003, public: anyone holding a printed certificate checks it by the token in its
 * verification link, without signing in (AC-ENRL-003.4, .8). Only the five fields the API
 * shares are shown; it never sends courses, amounts, or ids.
 */
export function VerifyCertificatePage({ token }: { token: string }) {
  const check = useQuery({
    queryKey: ["certificate-verify", token],
    queryFn: () => certificateApi.verify(token),
    // A 404 or 429 is the answer; asking again would only spend the visitor's checks.
    retry: false,
  });
  const notFound = check.error instanceof ApiError && check.error.status === 404;

  return (
    <AuthShell skipLabel="Skip to certificate check">
      <div className="auth-step" id="sign-in">
        <header>
          <h1 id="auth-title">Certificate check</h1>
          <p className="auth-subtitle">
            Confirms a PUP Certificate of Registration is genuine and current.
          </p>
        </header>

        {check.isPending && (
          <p role="status" className="mt-4 text-sm">
            Checking the certificate
          </p>
        )}

        {check.isError && (
          <div role="alert" className="mt-4 text-sm">
            <p className="font-semibold">{verifyErrorMessage(check.error)}</p>
            {!notFound && (
              <button
                type="button"
                onClick={() => void check.refetch()}
                className="bg-brand-crimson mt-4 min-h-11 rounded-xl px-5 text-sm font-semibold text-white hover:opacity-90"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {check.data && (
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <div>
              <dt className="font-semibold">Name</dt>
              <dd>{check.data.name}</dd>
            </div>
            <div>
              <dt className="font-semibold">Student number</dt>
              <dd>{check.data.studentNumber}</dd>
            </div>
            <div>
              <dt className="font-semibold">Term</dt>
              <dd>{termName(check.data.term)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Date issued</dt>
              <dd>{issuedOn(check.data.issuedAt)}</dd>
            </div>
            <div>
              <dt className="font-semibold">Status</dt>
              <dd className="font-bold">{certificateStatusLabel(check.data.status)}</dd>
            </div>
          </dl>
        )}
      </div>
    </AuthShell>
  );
}
