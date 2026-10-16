import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { session } from "../../lib/auth";

/**
 * When the session ends, for any reason, drop cached data and return to sign-in, saying why
 * when the person did not ask for it. While the account still holds a temporary password,
 * send it to the password change: the API refuses everything else until then.
 */
export function SessionWatcher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => {
    const stopEvents = session.subscribe((event) => {
      if (event === "signed-in") return;
      queryClient.clear();
      void navigate({
        to: "/",
        search:
          event === "expired"
            ? { expired: true }
            : event === "timed-out"
              ? { expired: "idle" }
              : {},
      });
    });
    const stopChange = session.onPasswordChangeRequired(
      () => void navigate({ to: "/change-password", replace: true }),
    );
    return () => {
      stopEvents();
      stopChange();
    };
  }, [navigate, queryClient]);
  return null;
}
