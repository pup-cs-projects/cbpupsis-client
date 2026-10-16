import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useCountdown, useCodeWindow } from "./useCountdown";

afterEach(() => {
  vi.useRealTimers();
});
describe("server deadline feedback", () => {
  it("reaches zero without becoming negative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const { result } = renderHook(() => useCountdown(12_000));
    expect(result.current).toBe(2);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(0);
  });
  it("advances code windows using the configured period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(44_000);
    const { result } = renderHook(() => useCodeWindow(45));
    expect(result.current).toEqual({ remaining: 1, window: 0 });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toEqual({ remaining: 45, window: 1 });
  });
});
