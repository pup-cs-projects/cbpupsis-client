import { ApiError } from "../api/errors";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * What changed: a sign-in, a sign-out the user asked for, or a session the API ended (idle
 * timeout, or a refresh it refused). Apps redirect to sign-in on the last two and explain
 * only the last one.
 */
export type SessionEvent = "signed-in" | "signed-out" | "expired";

export interface Session {
  isSignedIn(): boolean;
  /** Start a session from the tokens a sign-in step returned. */
  signIn(tokens: Tokens): void;
  /** End the session: forget the tokens, then tell the API (best effort). */
  signOut(): Promise<void>;
  /**
   * Run an authenticated call. On a 401 it refreshes once and retries; if the refresh fails,
   * or the API says the session idled out, the session ends and the 401 is rethrown.
   */
  authorized<T>(call: (accessToken: string) => Promise<T>): Promise<T>;
  /** Returns the unsubscribe function. */
  subscribe(listener: (event: SessionEvent) => void): () => void;
}

export interface SessionOptions {
  refresh(refreshToken: string): Promise<Tokens>;
  logout(refreshToken: string): Promise<void>;
}

/**
 * The signed-in state for one app.
 *
 * Tokens live in this closure and nowhere else: never localStorage or sessionStorage
 * (CONVENTIONS, RA 10173). The cost is that a page reload signs the user out, accepted until
 * the API's session-storage decision closes.
 */
export function createSession({ refresh, logout }: SessionOptions): Session {
  let tokens: Tokens | null = null;
  let refreshing: Promise<Tokens | null> | null = null;
  const listeners = new Set<(event: SessionEvent) => void>();

  function emit(event: SessionEvent) {
    listeners.forEach((listener) => listener(event));
  }

  function expire(ended: Tokens) {
    if (tokens !== ended) return;
    tokens = null;
    emit("expired");
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
        } catch {
          expire(current);
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
      emit("signed-in");
    },

    async signOut() {
      const current = tokens;
      if (!current) return;
      tokens = null;
      emit("signed-out");
      await logout(current.refreshToken).catch(() => undefined);
    },

    async authorized(call) {
      const current = tokens;
      if (!current) throw new ApiError(401, "NOT_SIGNED_IN");
      try {
        return await call(current.accessToken);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        // An idle session is deleted server-side; a refresh cannot revive it (AC-104.7).
        if (error.code === "AUTH_SESSION_EXPIRED") {
          expire(current);
          throw error;
        }
        // Another call may already have refreshed while this one was in flight.
        const fresh = tokens && tokens !== current ? tokens : await refreshOnce();
        if (!fresh) throw error;
        return call(fresh.accessToken);
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
