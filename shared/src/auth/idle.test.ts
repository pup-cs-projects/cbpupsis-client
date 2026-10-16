import { describe, expect, it } from "vitest";

import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, idleState } from "./idle";

const minute = 60_000;

describe("idleState (FR1)", () => {
  it("matches the API's 15 minute idle sign-out with a warning 5 minutes before", () => {
    expect(IDLE_TIMEOUT_MS).toBe(15 * minute);
    expect(IDLE_WARNING_MS).toBe(5 * minute);
  });

  it("stays active until 10 minutes without activity", () => {
    expect(idleState(0, 10 * minute - 1)).toEqual({ phase: "active", warnAt: 10 * minute });
  });

  it("warns from 10 minutes, counting down to the 15 minute mark", () => {
    expect(idleState(0, 10 * minute)).toEqual({ phase: "warning", endsAt: 15 * minute });
    expect(idleState(0, 15 * minute - 1)).toEqual({ phase: "warning", endsAt: 15 * minute });
  });

  it("ends at 15 minutes", () => {
    expect(idleState(0, 15 * minute)).toEqual({ phase: "ended" });
  });

  it("starts over from the latest activity", () => {
    expect(idleState(9 * minute, 12 * minute).phase).toBe("active");
  });
});
