import type { EnrollmentReport, ReportGroup } from "@cbpupsis/shared/reports/admin";
import { adminCard } from "../../components/AdminPage";

export function EnrollmentChart({
  report,
  groupBy,
  onDrill,
  busy,
}: {
  report: EnrollmentReport;
  groupBy: ReportGroup;
  onDrill: (program: string) => void;
  busy: boolean;
}) {
  const maximum = report.rows.reduce((max, row) => Math.max(max, row.count), 1);
  return (
    <figure
      className={adminCard}
      aria-labelledby="enrollment-chart-title"
      aria-describedby="enrollment-chart-help"
    >
      <figcaption id="enrollment-chart-title" className="font-semibold">
        Enrollment distribution
      </figcaption>
      <p id="enrollment-chart-help" className="text-brand-muted mt-2 text-sm">
        The Enrollment counts table below contains the same values.
        {groupBy === "program" ? " Select a program to view its year levels and sections." : ""}
      </p>
      <ul className="mt-5 space-y-3">
        {report.rows.map((row) => {
          const canDrill = groupBy === "program" && row.group && row.group !== "Unknown";
          const content = (
            <>
              <span className="mb-3 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 font-semibold break-words">
                  {row.group || "Unspecified"}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {row.count.toLocaleString("en-PH")}
                </span>
              </span>
              <span
                aria-hidden="true"
                className="bg-brand-maroon/10 block h-5 overflow-hidden rounded"
              >
                <span
                  className="bg-brand-maroon block h-full rounded"
                  style={{ width: `${(row.count / maximum) * 100}%` }}
                />
              </span>
            </>
          );
          return (
            <li key={row.group}>
              {canDrill ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDrill(row.group)}
                  className="text-brand-maroon hover:bg-brand-maroon/5 min-h-11 w-full cursor-pointer rounded-lg p-3 text-left focus-visible:outline-offset-0! disabled:cursor-not-allowed disabled:opacity-50"
                  aria-describedby="enrollment-chart-help"
                >
                  {content}
                  <span className="sr-only">
                    {" "}
                    enrollment records. View year levels and sections.
                  </span>
                </button>
              ) : (
                <div className="p-3">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
