import { idleState } from "@cbpupsis/shared/auth";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { authApi, session } from "../../lib/auth";

/**
 * The idle sign-out (FR1), measured from the API's own idle clock (session.lastActivity).
 *
 * `endsAt` is when the session will end while the warning is due, else null. It is checked
 * every second, but only a change re-renders. When time runs out the session times out, which
 * sends the app to sign-in with the reason.
 */
export function useIdleTimeout() {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const shown = useRef<number | null>(null);
  // Where focus was before the warning took it, to give it back afterwards.
  const returnFocus = useRef<Element | null>(null);

  const check = useCallback(() => {
    const last = session.lastActivity();
    const state = last === null ? null : idleState(last, Date.now());
    if (state?.phase === "ended") void session.timeOut();
    const next = state?.phase === "warning" ? state.endsAt : null;
    if (shown.current === null && next !== null) returnFocus.current = document.activeElement;
    shown.current = next;
    setEndsAt(next);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(check, 1000);
    return () => window.clearInterval(timer);
  }, [check]);

  // Any authenticated request restarts the API's idle clock; this one asks for nothing else.
  const stay = useMutation({
    mutationFn: () => session.authorized(authApi.me),
    retry: false,
    onSuccess: () => check(),
  });

  // A failed attempt from an earlier warning must not greet the next one.
  const clearStay = stay.reset;
  useEffect(() => {
    if (endsAt === null) clearStay();
  }, [endsAt, clearStay]);

  const signOut = useMutation({ mutationFn: () => session.signOut() });

  return { endsAt, stay, signOut, returnFocus };
}
