import { useEffect, useRef } from "react";

/**
 * Move focus to the heading whenever the step changes, and when the screen first opens, so a
 * keyboard or screen-reader user starts at the top of what is new.
 */
export function useStepHeading(step: string) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  return heading;
}
