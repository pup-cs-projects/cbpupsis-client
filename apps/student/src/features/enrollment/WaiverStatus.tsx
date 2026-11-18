import { errorMessage } from "@cbpupsis/shared/api";

import { WAIVER_STEP } from "./blocking";
import { useWaivers } from "./useWaiver";

const button =
  "border-brand-maroon text-brand-maroon inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold";

/** The step each waiver filed for this section is at (AC-ENRL-002.9). */
export function WaiverStatus({ sectionId }: { sectionId: string }) {
  const waivers = useWaivers();

  if (waivers.isPending) {
    return (
      <p role="status" className="text-brand-muted text-sm">
        Loading your waivers...
      </p>
    );
  }

  if (waivers.isError) {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-brand-ink text-sm">{errorMessage(waivers.error)}</p>
        <button type="button" className={button} onClick={() => void waivers.refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const mine = waivers.data.filter((waiver) => waiver.sectionId === sectionId);
  if (mine.length === 0) {
    return <p className="text-brand-muted text-sm">You have not filed a waiver for this course.</p>;
  }

  return (
    <ul aria-live="polite" className="space-y-2 text-sm">
      {mine.map((waiver) => (
        <li key={waiver.waiverRequestId} className="break-words">
          <span className="font-semibold">Waiver for {waiver.prerequisiteCourseCode}:</span>{" "}
          {WAIVER_STEP[waiver.state]}
          {waiver.reviewRemarks && <span className="block">Remarks: {waiver.reviewRemarks}</span>}
        </li>
      ))}
    </ul>
  );
}
