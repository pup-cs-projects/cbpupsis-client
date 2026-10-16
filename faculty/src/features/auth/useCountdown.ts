import { useEffect, useState } from "react";

export function useCountdown(deadline?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return deadline === undefined ? undefined : Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Advisory only. The API always decides whether a submitted code is valid. */
export function useCodeWindow(period: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return {
    remaining: period - (Math.floor(now / 1000) % period),
    window: Math.floor(now / (period * 1000)),
  };
}
