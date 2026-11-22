import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import type {
  EnrollmentExportFormat,
  EnrollmentGroupBy,
  EnrollmentReport,
  EnrollmentReportFilters,
} from "@cbpupsis/shared/reports";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useId, useState, type FormEvent } from "react";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useMe } from "../sign-in/useAdminAuth";
import { reportKeys, reportTabsFor, scopeLabel } from "./access";
import { reportsDataSource, type ReportsDataSource, type TermOption } from "./dataSource";

const button =
  "focus-visible:outline-offset-0! inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-brand-maroon bg-white px-4 py-2 text-sm font-semibold text-brand-maroon hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  button + " bg-brand-maroon! text-white! hover:bg-brand-maroon-dark! border-brand-maroon";
const card = "border-brand-border/25 min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6";
const field =
  "border-brand-input-border focus-visible:outline-offset-0! min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm text-brand-input-text";
const label = "block min-w-0 text-sm font-medium text-brand-ink";

const OTHER_TERM = "__other__";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Term enrollment statuses the API stores (enrollment/constants.py). */
const STATUSES = [
  { value: "enrolled", label: "Enrolled" },
  { value: "ENROLLED_PENDING", label: "Enrolled, pending" },
  { value: "OFFICIALLY_ENROLLED", label: "Officially enrolled" },
] as const;

const GROUPS: { value: EnrollmentGroupBy; label: string; column: string }[] = [
  { value: "program", label: "By program", column: "Program" },
  { value: "status", label: "By enrollment status", column: "Enrollment status" },
  { value: "yearLevel", label: "By year level", column: "Year level" },
  { value: "sex", label: "By sex", column: "Sex" },
  { value: "section", label: "By section", column: "Section" },
];
const DRILL_GROUPS: EnrollmentGroupBy[] = ["yearLevel", "section"];

function groupInfo(value: EnrollmentGroupBy) {
  return GROUPS.find((group) => group.value === value) ?? GROUPS[0]!;
}

function groupName(groupBy: EnrollmentGroupBy, group: string): string {
  if (groupBy === "status") {
    return STATUSES.find((s) => s.value.toLowerCase() === group.toLowerCase())?.label ?? group;
  }
  if (groupBy === "yearLevel" && /^\d+$/.test(group)) return `Year ${group}`;
  return group || "Unspecified";
}

const count = new Intl.NumberFormat("en-PH");

/** Saves a downloaded file under `filename` without leaving the page. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** What to tell the admin for a failed report call, branching on the API's `code`. */
function reportErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "RESOURCE_NOT_FOUND" || error.status === 404)
      return "We could not find that term. Choose another term, then generate the report again.";
    if (error.code === "INVALID_INPUT" || error.status === 400 || error.status === 422)
      return `Check the filters, then generate the report again.${error.detail ? ` (${error.detail})` : ""}`;
  }
  return errorMessage(error);
}

function isForbidden(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 403 || error.code === "AUTH_INSUFFICIENT_ROLE")
  );
}

export function ReportsPage({
  dataSource = reportsDataSource,
}: {
  dataSource?: ReportsDataSource;
}) {
  const me = useMe();
  const position = me.data?.position;
  const tabs = me.isSuccess ? reportTabsFor(position) : [];
  const [forbidden, setForbidden] = useState(false);
  const denied = forbidden || (me.isSuccess && tabs.length === 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <header>
          <nav aria-label="Breadcrumb">
            <ol className="text-brand-muted flex flex-wrap gap-1 text-sm">
              <li>
                <Link to="/dashboard" className="hover:underline">
                  Dashboard
                </Link>
                <span aria-hidden="true"> / </span>
              </li>
              <li aria-current="page">Reports</li>
            </ol>
          </nav>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold">Reports</h1>
          <p className="text-brand-muted mt-2 max-w-2xl text-sm leading-relaxed">
            Counts for your scope only. Reports never show names or student numbers.
          </p>
        </header>
        {me.isPending ? (
          <p role="status">Checking access…</p>
        ) : me.isError ? (
          <div role="alert" className={card}>
            <p>{errorMessage(me.error)}</p>
            <button className={button + " mt-4"} onClick={() => void me.refetch()}>
              Retry
            </button>
          </div>
        ) : denied ? (
          <section className={card}>
            <p role="alert">No reports are available to your role.</p>
            <Link to="/dashboard" className={button + " mt-4"}>
              Back to dashboard
            </Link>
          </section>
        ) : (
          <>
            <div
              role="tablist"
              aria-label="Report type"
              className="border-brand-border/40 flex gap-2 overflow-x-auto border-b"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  id={`report-tab-${tab.id}`}
                  aria-selected="true"
                  aria-controls={`report-panel-${tab.id}`}
                  className="text-brand-maroon border-brand-maroon min-h-11 border-b-2 px-4 py-2 text-sm font-bold tracking-wide uppercase"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id="report-panel-enrollment"
              aria-labelledby="report-tab-enrollment"
            >
              <EnrollmentTab
                dataSource={dataSource}
                owner={me.data.id}
                position={position}
                onForbidden={() => setForbidden(true)}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function EnrollmentTab({
  dataSource,
  owner,
  position,
  onForbidden,
}: {
  dataSource: ReportsDataSource;
  owner: string;
  position: string | undefined;
  onForbidden: () => void;
}) {
  const ids = useId();
  const terms = useQuery({
    queryKey: reportKeys.terms(owner),
    queryFn: ({ signal }) => dataSource.terms(signal),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const termOptions: TermOption[] = terms.data ?? [];
  const [termChoice, setTermChoice] = useState("");
  const [typedTerm, setTypedTerm] = useState("");
  const [program, setProgram] = useState("");
  const [status, setStatus] = useState("");
  const [termError, setTermError] = useState<string | null>(null);
  const [applied, setApplied] = useState<EnrollmentReportFilters | null>(null);
  const [appliedTermLabel, setAppliedTermLabel] = useState("");
  const [groupBy, setGroupBy] = useState<EnrollmentGroupBy>("program");
  const [drill, setDrill] = useState<string | null>(null);
  const [exporting, setExporting] = useState<EnrollmentExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const typing = !terms.isPending && (termOptions.length === 0 || termChoice === OTHER_TERM);
  const filters: EnrollmentReportFilters | null = applied && {
    ...applied,
    groupBy,
    ...(drill ? { programCode: drill } : {}),
  };
  const report = useQuery({
    queryKey: reportKeys.enrollment(owner, filters),
    queryFn: ({ signal }) => dataSource.enrollment(filters!, signal),
    enabled: filters !== null,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const reportForbidden = isForbidden(report.error);
  useEffect(() => {
    if (reportForbidden) onForbidden();
  }, [reportForbidden, onForbidden]);

  function generate(event: FormEvent) {
    event.preventDefault();
    const termId = (typing ? typedTerm : termChoice).trim();
    if (!termId) {
      setTermError("Choose a term.");
      return;
    }
    if (!UUID.test(termId)) {
      setTermError("Enter the term ID exactly as the registrar gave it.");
      return;
    }
    setTermError(null);
    setExportError(null);
    setDrill(null);
    setGroupBy("program");
    setAppliedTermLabel(termOptions.find((term) => term.id === termId)?.label ?? termId);
    const next: EnrollmentReportFilters = {
      termId,
      groupBy: "program",
      ...(program.trim() ? { programCode: program.trim() } : {}),
      ...(status ? { status } : {}),
    };
    if (filters && JSON.stringify(next) === JSON.stringify(filters)) void report.refetch();
    setApplied(next);
  }

  async function download(format: EnrollmentExportFormat) {
    if (!filters || exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      const blob = await dataSource.exportEnrollment(filters, format);
      saveBlob(blob, `enrollment-report.${format}`);
    } catch (error) {
      if (isForbidden(error)) onForbidden();
      else setExportError(reportErrorMessage(error));
    } finally {
      setExporting(null);
    }
  }

  const appliedProgram = drill ?? applied?.programCode;
  const appliedStatus = STATUSES.find((s) => s.value === applied?.status)?.label;
  const filterSummary = [
    `Term: ${appliedTermLabel}`,
    `Program: ${appliedProgram ?? "All programs"}`,
    `Status: ${appliedStatus ?? "All statuses"}`,
  ].join(", ");
  const groupChoices = drill ? GROUPS.filter((g) => DRILL_GROUPS.includes(g.value)) : GROUPS;

  return (
    <div className="mt-6 space-y-6">
      <section className={card} aria-labelledby={`${ids}-filters`}>
        <h2 id={`${ids}-filters`} className="text-brand-ink text-lg font-bold">
          Enrollment report
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          {scopeLabel(position)}. Fields marked * are required.
        </p>
        <form
          noValidate
          onSubmit={generate}
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div className="min-w-0">
            {terms.isPending ? (
              <p role="status" className="text-sm">
                Loading terms…
              </p>
            ) : (
              <>
                {termOptions.length > 0 && (
                  <label className={label}>
                    Term *
                    <select
                      className={field + " mt-2"}
                      value={termChoice}
                      required
                      aria-invalid={!!termError && !typing}
                      aria-describedby={`${ids}-term-error`}
                      onChange={(event) => {
                        setTermChoice(event.target.value);
                        setTermError(null);
                      }}
                    >
                      <option value="">Choose a term</option>
                      {termOptions.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.label}
                        </option>
                      ))}
                      <option value={OTHER_TERM}>Another term (enter its ID)</option>
                    </select>
                  </label>
                )}
                {typing && (
                  <label className={label + (termOptions.length > 0 ? " mt-3" : "")}>
                    Term ID *
                    <input
                      className={field + " mt-2"}
                      value={typedTerm}
                      required
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={!!termError}
                      aria-describedby={`${ids}-term-help ${ids}-term-error`}
                      onChange={(event) => {
                        setTypedTerm(event.target.value);
                        setTermError(null);
                      }}
                    />
                  </label>
                )}
                {typing && (
                  <p id={`${ids}-term-help`} className="text-brand-muted mt-1 text-xs">
                    The academic term&apos;s 36-character ID, such as
                    30000000-0000-4000-8000-000000000001.
                  </p>
                )}
              </>
            )}
            <p
              id={`${ids}-term-error`}
              role={termError ? "alert" : undefined}
              className="mt-1 text-xs text-red-700"
            >
              {termError}
            </p>
          </div>
          <label className={label}>
            Program code
            <input
              className={field + " mt-2"}
              value={program}
              placeholder="All programs"
              autoComplete="off"
              onChange={(event) => setProgram(event.target.value)}
            />
          </label>
          <label className={label}>
            Enrollment status
            <select
              className={field + " mt-2"}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className={primary + " w-full"}
              disabled={terms.isPending || report.isFetching}
            >
              {report.isFetching ? "Generating…" : "Generate report"}
            </button>
          </div>
        </form>
      </section>

      {filters && (
        <ReportResults
          report={report.data}
          pending={report.isPending}
          error={report.error && !isForbidden(report.error) ? report.error : null}
          onRetry={() => void report.refetch()}
          groupBy={groupBy}
          groupChoices={groupChoices}
          onGroupBy={setGroupBy}
          drill={drill}
          onDrill={(program) => {
            setDrill(program);
            setGroupBy("yearLevel");
          }}
          onUndrill={() => {
            setDrill(null);
            setGroupBy("program");
          }}
          filterSummary={filterSummary}
          exporting={exporting}
          exportError={exportError}
          onExport={(format) => void download(format)}
        />
      )}
    </div>
  );
}

function ReportResults({
  report,
  pending,
  error,
  onRetry,
  groupBy,
  groupChoices,
  onGroupBy,
  drill,
  onDrill,
  onUndrill,
  filterSummary,
  exporting,
  exportError,
  onExport,
}: {
  report: EnrollmentReport | undefined;
  pending: boolean;
  error: Error | null;
  onRetry: () => void;
  groupBy: EnrollmentGroupBy;
  groupChoices: typeof GROUPS;
  onGroupBy: (value: EnrollmentGroupBy) => void;
  drill: string | null;
  onDrill: (program: string) => void;
  onUndrill: () => void;
  filterSummary: string;
  exporting: EnrollmentExportFormat | null;
  exportError: string | null;
  onExport: (format: EnrollmentExportFormat) => void;
}) {
  const ids = useId();
  const info = groupInfo(groupBy);
  const canDrill = groupBy === "program" && !drill;
  const hasRows = !!report && report.rows.length > 0;
  const max = report ? Math.max(1, ...report.rows.map((row) => row.count)) : 1;
  const requestId = error instanceof ApiError ? error.requestId : undefined;

  return (
    <section className={card + " space-y-5"} aria-labelledby={`${ids}-title`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={`${ids}-title`} className="text-brand-ink text-lg font-bold">
            {drill ? `Program ${drill}` : "Enrollment counts"}
          </h2>
          <p className="text-brand-muted mt-1 text-sm break-words">{filterSummary}</p>
          {drill && (
            <button type="button" className={button + " mt-3"} onClick={onUndrill}>
              Back to all programs
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={!hasRows || !!exporting}
            onClick={() => onExport("csv")}
          >
            {exporting === "csv" ? "Exporting CSV…" : "Export CSV"}
          </button>
          <button
            type="button"
            className={button}
            disabled={!hasRows || !!exporting}
            onClick={() => onExport("pdf")}
          >
            {exporting === "pdf" ? "Exporting PDF…" : "Export PDF"}
          </button>
        </div>
      </div>
      {exportError && (
        <p role="alert" className="text-sm text-red-700">
          {exportError}
        </p>
      )}
      <label className={label + " max-w-xs"}>
        Group by
        <select
          className={field + " mt-2"}
          value={groupBy}
          onChange={(event) => onGroupBy(event.target.value as EnrollmentGroupBy)}
        >
          {groupChoices.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
      </label>

      {pending ? (
        <p role="status">Generating the enrollment report…</p>
      ) : error ? (
        <div role="alert" className="text-sm">
          <p>{reportErrorMessage(error)}</p>
          {requestId && <p className="text-brand-muted mt-1 text-xs">Request ID: {requestId}</p>}
          <button type="button" className={button + " mt-3"} onClick={onRetry}>
            Retry report
          </button>
        </div>
      ) : !hasRows ? (
        <p role="status" className="text-brand-muted py-6 text-sm">
          No enrolled students match these filters: {filterSummary}.
        </p>
      ) : (
        <>
          <div className="bg-brand-paper rounded-xl p-4">
            <p className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
              Total enrolled
            </p>
            <p className="text-brand-maroon mt-1 text-3xl font-bold">
              {count.format(report.total)}
            </p>
          </div>
          <figure className="min-w-0">
            <figcaption className="text-brand-ink text-sm font-semibold">
              Enrollment {info.label.toLowerCase()}
              <span className="text-brand-muted block text-xs font-normal">
                The table below lists the same numbers.
              </span>
            </figcaption>
            {/* The table is the chart's text alternative, so the bars are hidden from readers. */}
            <div aria-hidden="true" className="mt-3 space-y-2" data-testid="enrollment-chart">
              {report.rows.map((row) => {
                const bar = (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-20 shrink-0 truncate text-left text-xs sm:w-28">
                      {groupName(groupBy, row.group)}
                    </span>
                    <span className="bg-brand-paper h-6 min-w-0 flex-1 rounded">
                      <span
                        className="bg-brand-maroon block h-6 rounded"
                        style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
                      />
                    </span>
                    <span className="w-12 shrink-0 text-right text-xs">
                      {count.format(row.count)}
                    </span>
                  </span>
                );
                return canDrill ? (
                  <button
                    key={row.group}
                    type="button"
                    tabIndex={-1}
                    className="block w-full cursor-pointer hover:opacity-80"
                    onClick={() => onDrill(row.group)}
                  >
                    {bar}
                  </button>
                ) : (
                  <div key={row.group}>{bar}</div>
                );
              })}
            </div>
          </figure>
          <div
            className="focus-visible:outline-brand-maroon overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
            role="region"
            aria-label="Enrollment counts table"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A scrollable table needs keyboard access at 320px.
            tabIndex={0}
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Enrollment counts {info.label.toLowerCase()}. {filterSummary}
              </caption>
              <thead className="bg-brand-maroon text-white">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    {info.column}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Students
                  </th>
                  {canDrill && (
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">Drill down</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.group} className="border-brand-border/25 border-b">
                    <th scope="row" className="px-4 py-3 font-medium">
                      {groupName(groupBy, row.group)}
                    </th>
                    <td className="px-4 py-3 text-right">{count.format(row.count)}</td>
                    {canDrill && (
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className={button}
                          aria-label={`Details for ${row.group}`}
                          onClick={() => onDrill(row.group)}
                        >
                          Details
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <th scope="row" className="px-4 py-3">
                    Total
                  </th>
                  <td className="px-4 py-3 text-right">{count.format(report.total)}</td>
                  {canDrill && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
