import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { session } from "../../lib/auth";

/** When the session ends, for any reason, drop cached data and return to sign-in. */
export function SessionWatcher() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(
    () =>
      session.subscribe((event) => {
        if (event === "signed-in") return;
        queryClient.clear();
        void navigate({ to: "/", search: event === "expired" ? { expired: true } : {} });
      }),
    [navigate, queryClient],
  );
  return null;
}
