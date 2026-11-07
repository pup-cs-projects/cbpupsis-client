import type { EnrollmentEligibility } from "@cbpupsis/shared/enrollment";

interface LimitPanelProps {
  eligibility: EnrollmentEligibility;
  runningTotal: number;
  subjectCount: number;
}

const card = "border-brand-border/25 rounded-2xl border bg-white p-5 shadow-sm";
const stat = "text-brand-muted text-xs font-semibold tracking-wide uppercase";

/**
 * The student's unit ceiling and the running total of what they have picked, announced live as
 * checkboxes are toggled (AC-ENRL-001.1, .6, .7). None of these numbers are fixed client-side;
 * every one comes from the eligibility response.
 */
export function LimitPanel({ eligibility, runningTotal, subjectCount }: LimitPanelProps) {
  const overLimit = runningTotal > eligibility.effectiveCeiling;
  const overSummerCap =
    eligibility.summerSubjectCap !== null && subjectCount > eligibility.summerSubjectCap;
  const unitsOver = Math.round((runningTotal - eligibility.effectiveCeiling) * 10) / 10;

  return (
    <section aria-labelledby="limit-panel-heading" className={card}>
      <h2 id="limit-panel-heading" className="text-brand-ink text-base font-bold">
        Your Unit Limit
      </h2>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className={stat}>Prescribed Load</dt>
          <dd className="text-brand-ink mt-1 text-xl font-bold tabular-nums">
            {eligibility.prescribedLoad}
          </dd>
        </div>
        <div>
          <dt className={stat}>Approved Overload</dt>
          <dd className="text-brand-ink mt-1 text-xl font-bold tabular-nums">
            {eligibility.approvedOverloadUnits}
          </dd>
        </div>
        <div>
          <dt className={stat}>Standing Reduction</dt>
          <dd className="text-brand-ink mt-1 text-xl font-bold tabular-nums">
            {eligibility.standingReduction}
          </dd>
        </div>
        <div>
          <dt className={stat}>Effective Ceiling</dt>
          <dd className="text-brand-maroon mt-1 text-xl font-bold tabular-nums">
            {eligibility.effectiveCeiling}
          </dd>
        </div>
      </dl>

      {eligibility.summerSubjectCap !== null && (
        <p className="text-brand-muted mt-4 text-sm">
          Summer limit: {eligibility.summerSubjectCap} subjects
        </p>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-label="Running total"
        className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
          overLimit
            ? "border-amber-700/30 bg-amber-100 text-amber-900"
            : "border-brand-border/20 bg-brand-paper text-brand-ink"
        }`}
      >
        <p className="font-bold">
          Running Total: <span className="tabular-nums">{runningTotal}</span> unit
          {runningTotal === 1 ? "" : "s"}
        </p>
        {overLimit && (
          <p className="mt-1">
            That is {unitsOver} unit{unitsOver === 1 ? "" : "s"} over your limit of{" "}
            {eligibility.effectiveCeiling}. You can still submit: the system makes the final call.
          </p>
        )}
        {overSummerCap && (
          <p className="mt-1">
            You have picked {subjectCount} subjects, over the summer limit of{" "}
            {eligibility.summerSubjectCap}.
          </p>
        )}
      </div>
    </section>
  );
}
