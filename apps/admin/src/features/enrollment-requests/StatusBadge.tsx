import { STATE_LABELS } from "./reviewRules";
import type { RequestState } from "./types";

export function StatusBadge({ state }: { state: RequestState }) {
  const tone =
    state === "APPROVED"
      ? "border-brand-success/50 text-brand-success"
      : state === "REJECTED"
        ? "border-brand-maroon/50 text-brand-maroon"
        : "border-brand-border/40 text-brand-help";

  return (
    <span
      className={`inline-block rounded-sm border bg-white px-2 py-1 text-xs font-semibold whitespace-nowrap ${tone}`}
    >
      {STATE_LABELS[state]}
    </span>
  );
}
