import { ApiError, isPasswordChangeRequired } from "../api/errors";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * What changed: a sign-in, a sign-out the user asked for, a session the API ended (idle
 * timeout, or a refresh it refused), or one this client ended because the person was idle
 * (`timed-out`). Apps redirect to sign-in on the last three and explain the last two.
 */
export type SessionEvent = "signed-in" | "signed-out" | "expired" | "timed-out";

export interface Session {
  isSignedIn(): boolean;
  /** Start a session from the tokens a sign-in step returned. */
  signIn(tokens: Tokens): void;
  /**
   * After a page load, pick the session back up from the API's HttpOnly refresh cookie.
   * Resolves true when signed in. Runs at most once per page load; apps await it before
   * their first route so guards see the restored session. Never rejects: a refusal or a
   * failure to reach the API just means signed out.
   */
  restore(): Promise<boolean>;
  /** End the session: forget the tokens, then tell the API (best effort). */
  signOut(): Promise<void>;
  /**
   * End the session because the person was idle (see idle.ts): forget the tokens, report
   * `timed-out`, then tell the API (best effort).
   */
  timeOut(): Promise<void>;
  /**
   * Run an authenticated call. On a 401 it refreshes once and retries; if the refresh fails,
   * or the API says the session idled out, the session ends and the 401 is rethrown.
   */
  authorized<T>(call: (accessToken: string) => Promise<T>): Promise<T>;
  /**
   * When the API last counted this session as active (epoch ms), or null when signed out.
   *
   * The API restarts its idle clock on every authenticated request it receives, so this is
   * the start time of the latest call it answered. Using the start, not the answer, keeps the
   * client's estimate at or before the API's, so the client never outlives the server.
   */
  lastActivity(): number | null;
  /**
   * Returns the unsubscribe function. On `expired`, `reason` is the API's own sentence for why
   * it ended the session, when it gave one.
   */
  subscribe(listener: (event: SessionEvent, reason?: string) => void): () => void;
  /**
   * Called when an authenticated call answers 403 PASSWORD_CHANGE_REQUIRED: the account still
   * holds a temporary password. Returns the unsubscribe function.
   */
  onPasswordChangeRequired(listener: () => void): () => void;
}

export interface SessionOptions {
  /** With no token, the API reads its HttpOnly refresh cookie instead. */
  refresh(refreshToken?: string): Promise<Tokens>;
  logout(refreshToken: string): Promise<void>;
}

/**
 * The signed-in state for one app.
 *
 * Tokens live in this closure and nowhere else: never localStorage or sessionStorage
 * (CONVENTIONS, RA 10173). A page reload is survived through `restore()`, which asks the API
 * for fresh tokens with the HttpOnly refresh cookie that script can never read.
 */
export function createSession({ refresh, logout }: SessionOptions): Session {
  let tokens: Tokens | null = null;
  let activity: number | null = null;
  let refreshing: Promise<Tokens | null> | null = null;
  let restoring: Promise<boolean> | null = null;
  const listeners = new Set<(event: SessionEvent, reason?: string) => void>();
  const changeListeners = new Set<() => void>();

  function emit(event: SessionEvent, reason?: string) {
    listeners.forEach((listener) => listener(event, reason));
  }

  /** The API ended the session; `refusal` is its answer, whose sentence says why. */
  function expire(ended: Tokens, refusal?: unknown) {
    if (tokens !== ended) return;
    tokens = null;
    activity = null;
    emit("expired", refusal instanceof ApiError ? refusal.detail : undefined);
  }

  async function end(event: "signed-out" | "timed-out") {
    const current = tokens;
    if (!current) return;
    tokens = null;
    activity = null;
    emit(event);
    await logout(current.refreshToken).catch(() => undefined);
  }

  function seen(at: number) {
    if (tokens) activity = Math.max(activity ?? 0, at);
  }

  /** One call with one access token, recording what the API saw of it. */
  async function attempt<T>(accessToken: string, call: (accessToken: string) => Promise<T>) {
    const started = Date.now();
    try {
      const result = await call(accessToken);
      seen(started);
      return result;
    } catch (error) {
      // Any answer but a 401 means the API accepted the session first, which restarts its
      // idle clock. A 0 never reached it.
      if (error instanceof ApiError && error.status !== 0 && error.status !== 401) seen(started);
      if (isPasswordChangeRequired(error)) changeListeners.forEach((listener) => listener());
      throw error;
    }
  }

  /** One refresh at a time: concurrent 401s share it, because each refresh rotates the token. */
  function refreshOnce(): Promise<Tokens | null> {
    if (!refreshing) {
      const current = tokens;
      refreshing = (async () => {
        if (!current) return null;
        try {
          const next = await refresh(current.refreshToken);
          // A sign-out while the refresh was in flight wins; end the session it just rotated.
          if (tokens !== current) {
            await logout(next.refreshToken).catch(() => undefined);
            return null;
          }
          tokens = next;
          return next;
        } catch (error) {
          expire(current, error);
          return null;
        } finally {
          refreshing = null;
        }
      })();
    }
    return refreshing;
  }

  return {
    isSignedIn: () => tokens !== null,

    signIn(next) {
      tokens = next;
      activity = Date.now();
      emit("signed-in");
    },

    restore() {
      restoring ??= tokens
        ? Promise.resolve(true)
        : refresh().then(
            (next) => {
              // A sign-in that finished first keeps its own tokens.
              if (!tokens) {
                tokens = next;
                activity = Date.now();
              }
              return true;
            },
            () => tokens !== null,
          );
      return restoring;
    },

    signOut: () => end("signed-out"),

    timeOut: () => end("timed-out"),

    async authorized(call) {
      const current = tokens;
      if (!current) throw new ApiError(401, "NOT_SIGNED_IN");
      try {
        return await attempt(current.accessToken, call);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        // An idle session is deleted server-side; a refresh cannot revive it (AC-104.7).
        if (error.code === "AUTH_SESSION_EXPIRED") {
          expire(current, error);
          throw error;
        }
        // Another call may already have refreshed while this one was in flight.
        const fresh = tokens && tokens !== current ? tokens : await refreshOnce();
        if (!fresh) throw error;
        return attempt(fresh.accessToken, call);
      }
    },

    lastActivity: () => activity,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    onPasswordChangeRequired(listener) {
      changeListeners.add(listener);
      return () => changeListeners.delete(listener);
    },
  };
}
