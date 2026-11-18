import { AlertTriangle, ShieldAlert } from "lucide-react";

import type { Hold } from "./types";
import { formatAmount } from "./view";

interface HoldBannersProps {
  /**
   * `[]` means the student has no holds: nothing is shown. `null` means the API could not say,
   * and the student must not be told they are clear.
   */
  holds: Hold[] | null;
  onRetry: () => void;
}

/**
 * The student's holds, above everything else on the dashboard (AC-STU-001.2). Each banner
 * carries a warning icon and its status in words, so none of it rests on color alone
 * (AC-STU-001.13).
 */
export function HoldBanners({ holds, onRetry }: HoldBannersProps) {
  if (holds === null) return <HoldsUnavailable onRetry={onRetry} />;
  if (holds.length === 0) return null;

  return (
    <div className="space-y-3 px-4 pt-6 sm:px-8">
      {holds.map((hold, index) => (
        <div
          key={`${hold.type}-${hold.office}-${index}`}
          role="alert"
          className="border-brand-maroon bg-brand-cream text-brand-ink flex min-w-0 gap-3 rounded-xl border-2 px-4 py-3"
        >
          <ShieldAlert aria-hidden="true" className="text-brand-maroon mt-0.5 size-6 shrink-0" />
          <div className="min-w-0">
            <p className="text-brand-maroon text-sm font-bold break-words">
              Hold from {hold.office}
            </p>
            <p className="mt-0.5 text-sm break-words">{hold.description}</p>
            {hold.amount !== null && (
              <p className="mt-1 text-sm font-semibold break-words">
                Amount due:{" "}
                <span className="tabular-nums">{formatAmount(hold.amount, hold.currency)}</span>
              </p>
            )}
            <p className="text-brand-maroon mt-1 text-sm font-bold">
              {hold.blocksEnrollment ? "Blocks enrollment" : "Does not block enrollment"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HoldsUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-4 pt-6 sm:px-8">
      <div
        role="status"
        className="border-brand-border/60 text-brand-ink flex min-w-0 flex-wrap items-center gap-3 rounded-xl border-2 bg-white px-4 py-3"
      >
        <AlertTriangle aria-hidden="true" className="text-brand-maroon size-6 shrink-0" />
        <p className="min-w-0 flex-1 basis-48 text-sm break-words">
          <span className="font-bold">We couldn&apos;t check your account holds.</span> Any hold on
          your account may not be shown until this loads.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="border-brand-maroon text-brand-maroon hover:bg-brand-cream min-h-11 rounded-lg border px-4 text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
