import type { GoogleCalendarConnection } from "@cbpupsis/shared/schedule";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { session } from "../../lib/auth";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import {
  googleCalendarApi,
  googleCalendarError,
  googleCalendarKeys,
  readGoogleCallback,
} from "./googleCalendar";

export function GoogleCalendarCallbackPage() {
  const router = useRouter();
  // Read the original query: router search normalization may collapse duplicate parameters.
  const search = router.history.location.search;
  const input = useRef(readGoogleCallback(search));
  const pending = useRef<Promise<GoogleCalendarConnection> | null>(null);
  const navigate = useNavigate();
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(
    () =>
      readGoogleCallback(search).message ??
      (!session.isSignedIn()
        ? "Your student session has ended. Sign in, then connect again."
        : null),
  );

  useEffect(() => {
    let active = true;
    if (!pending.current) {
      const payload = input.current.payload;
      input.current = { payload: null, message: null };
      // Replace rather than push: codes/state must not remain in the address bar or back history.
      const scrub = navigate({ to: "/calendar/google/callback", search: {}, replace: true });
      if (!payload || !session.isSignedIn())
        return () => {
          active = false;
        };
      // The same promise is reused after rerenders and StrictMode effect replay. Never retry it.
      pending.current = scrub.then(() => googleCalendarApi.callback(payload));
    }
    pending.current.then(
      () => {
        if (!active) return;
        void client.invalidateQueries({ queryKey: googleCalendarKeys.all });
        void navigate({ to: "/schedule", search: {}, replace: true });
      },
      (failure) => {
        // The outcome is uncertain (409 included): the schedule page must re-read the status.
        void client.invalidateQueries({ queryKey: googleCalendarKeys.all });
        if (active) setError(googleCalendarError(failure));
      },
    );
    return () => {
      active = false;
    };
  }, [client, navigate]);

  return (
    <DashboardLayout>
      <section
        aria-labelledby="google-callback-heading"
        className="border-brand-border/25 mx-auto my-10 w-[calc(100%-2rem)] max-w-lg rounded-2xl border bg-white p-6 sm:p-8"
      >
        <h1 id="google-callback-heading" className="text-brand-maroon text-2xl font-bold">
          Google Calendar connection
        </h1>
        {error ? (
          <>
            <p role="alert" className="text-brand-maroon mt-4 text-sm leading-relaxed">
              {error}
            </p>
            <p className="text-brand-muted mt-3 text-sm">
              Return to your schedule to check the status or start a new connection. This sign-in
              will not be submitted again.
            </p>
            <Link
              to="/schedule"
              className="bg-brand-maroon mt-6 inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white"
            >
              Back to schedule
            </Link>
          </>
        ) : (
          <p role="status" className="text-brand-muted mt-4 text-sm">
            Completing your Google Calendar connection…
          </p>
        )}
      </section>
    </DashboardLayout>
  );
}
