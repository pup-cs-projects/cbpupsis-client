/**
 * The idle sign-out (FR1): the API ends a session after this much inactivity, for every role.
 *
 * Mirrors the API's SESSION_IDLE_TIMEOUT_MINUTES default (15). The API does not tell clients
 * its configured value yet, so a deployment that changes it must change this too.
 */
export const IDLE_TIMEOUT_MS = 15 * 60_000;

/** How long before the sign-out the warning appears (FR1: five minutes). */
export const IDLE_WARNING_MS = 5 * 60_000;

export type IdleState =
  { phase: "active"; warnAt: number } | { phase: "warning"; endsAt: number } | { phase: "ended" };

/** Where a session stands, given when the API last saw it active and the time now (epoch ms). */
export function idleState(lastActivity: number, now: number): IdleState {
  const endsAt = lastActivity + IDLE_TIMEOUT_MS;
  const warnAt = endsAt - IDLE_WARNING_MS;
  if (now >= endsAt) return { phase: "ended" };
  if (now >= warnAt) return { phase: "warning", endsAt };
  return { phase: "active", warnAt };
}
