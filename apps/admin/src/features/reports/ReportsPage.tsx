import { ApiError } from "@cbpupsis/shared/api";
import {
  enrollmentReportQuery,
  type ReportFilters,
  type ReportGroup,
} from "@cbpupsis/shared/reports/admin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import {
  AdminPage,
  AdminTable,
  ApiFailure,
  Field,
  adminButton,
  adminCard,
  adminField,
  adminPrimary,
  uuidPattern,
} from "../../components/AdminPage";
import { session } from "../../lib/auth";
import { downloadFile } from "../../lib/downloadFile";
import { authKeys, useMe } from "../sign-in/useAdminAuth";
import { catalogScope } from "../catalog/catalogRules";
import { reportsApi } from "./api";
import { EnrollmentChart } from "./EnrollmentChart";
import { canReadEnrollmentReport, reportKeys, useReportAccess } from "./reportAccess";

const groupNames: Record<ReportGroup, string> = {
  program: "Program",
  yearLevel: "Year level",
  section: "Section",
  status: "Enrollment status",
  sex: "Sex",
};
const label = (filters: ReportFilters) =>
  `term ${filters.termId}; program ${filters.programCode || "all programs"}; status ${filters.status || "all statuses"}`;

export function ReportsPage() {
  const me = useMe();
  const client = useQueryClient();
  const access = useReportAccess();
  const [filters, setFilters] = useState<ReportFilters | null>(null);
  const [rootFilters, setRootFilters] = useState<ReportFilters | null>(null);
  const [notice, setNotice] = useState("");
  const report = useQuery({
    queryKey: [...reportKeys.user(me.data?.id), "enrollment", filters],
    queryFn: ({ signal }) => reportsApi.enrollment(filters!, signal),
    enabled: Boolean(access.allowed && filters && session.isSignedIn()),
    retry: false,
    refetchOnWindowFocus: true,
  });
  const exportFile = useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (format: "csv" | "pdf") => {
      if (!filters || !report.isSuccess || !access.allowed || !me.data)
        throw new ApiError(403, "AUTH_INSUFFICIENT_ROLE");
      const owner = me.data.id;
      const file = await reportsApi.exportEnrollment(filters, format);
      if (!session.isSignedIn() || client.getQueryData<{ id: string }>(authKeys.me())?.id !== owner)
        throw new ApiError(401, "NOT_SIGNED_IN");
      downloadFile(file, `enrollment-report.${format}`);
      setNotice(`Enrollment report ${format.toUpperCase()} is downloading.`);
    },
  });
  const deny = access.deny;
  useEffect(() => {
    if (
      [report.error, exportFile.error].some(
        (error) => error instanceof ApiError && error.status === 403,
      )
    )
      deny();
  }, [report.error, exportFile.error, deny]);
  function load(next: ReportFilters) {
    if (exportFile.isPending) return;
    setNotice("");
    exportFile.reset();
    if (filters && enrollmentReportQuery(next) === enrollmentReportQuery(filters))
      void report.refetch();
    else setFilters(next);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!access.allowed) return;
    const form = new FormData(event.currentTarget);
    const next: ReportFilters = {
      termId: String(form.get("termId")).trim(),
      programCode: String(form.get("programCode") ?? "").trim(),
      status: String(form.get("status") ?? "").trim(),
      groupBy: "program",
    };
    setRootFilters(next);
    load(next);
  }
  const busy = report.isFetching || exportFile.isPending;
  const denied = !access.allowed;
  return (
    <AdminPage
      title="Reports"
      description="Generate and export reports for your authorized academic scope."
    >
      {denied ? (
        <section className={adminCard}>
          <h2 className="text-lg font-bold">No reports available</h2>
          <p className="text-brand-muted mt-3 text-sm">
            {canReadEnrollmentReport(me.data?.position)
              ? "Your account does not have permission to view Enrollment reports. Contact your administrator if you need access."
              : "Enrollment reports are not available to your role."}
          </p>
        </section>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Available reports"
            className="admin-tabs border-brand-border/25 flex w-fit max-w-full overflow-hidden rounded-xl border bg-white"
          >
            <button
              id="enrollment-report-tab"
              type="button"
              role="tab"
              aria-selected="true"
              aria-controls="enrollment-report-panel"
              className="bg-brand-maroon min-h-12 cursor-pointer px-6 py-3 text-sm font-semibold text-white focus-visible:-outline-offset-3!"
            >
              Enrollment
            </button>
          </div>
          <section
            id="enrollment-report-panel"
            role="tabpanel"
            aria-labelledby="enrollment-report-tab"
            className="min-w-0 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Enrollment reports</h2>
              <p className="text-brand-muted text-sm">{catalogScope(me.data)}</p>
            </div>
            <form onSubmit={submit} className={adminCard + " space-y-4"}>
              <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-3">
                <legend className="sr-only">Enrollment report filters</legend>
                <Field label="Academic term reference">
                  <input
                    name="termId"
                    className={adminField}
                    required
                    pattern={uuidPattern}
                    aria-describedby="enrollment-term-help"
                  />
                </Field>
                <Field label="Program code (optional)">
                  <input
                    name="programCode"
                    className={adminField}
                    maxLength={30}
                    placeholder="All programs in your scope"
                  />
                </Field>
                <Field label="Enrollment status">
                  <select name="status" className={adminField} defaultValue="">
                    <option value="">All statuses</option>
                    <option value="ENROLLED_PENDING">Pending enrollment</option>
                    <option value="OFFICIALLY_ENROLLED">Officially enrolled</option>
                    <option value="enrolled">Enrolled</option>
                  </select>
                </Field>
              </fieldset>
              <p id="enrollment-term-help" className="text-brand-muted text-sm">
                Use the academic term reference provided by the Registrar. Generate applies these
                filters; exports use the report currently displayed.
              </p>
              <button className={adminPrimary} disabled={busy}>
                {report.isFetching ? "Generating…" : "Generate report"}
              </button>
            </form>
            {notice && <p role="status">{notice}</p>}
            {exportFile.isPending && (
              <p role="status">Preparing {exportFile.variables?.toUpperCase()} download…</p>
            )}
            {!filters && (
              <p className={adminCard}>Choose a term and generate an Enrollment report.</p>
            )}
            {filters && report.isFetching && <p role="status">Loading enrollment report…</p>}
            {report.isError && (
              <ApiFailure error={report.error} retry={() => void report.refetch()} />
            )}
            {exportFile.isError && (
              <ApiFailure
                error={exportFile.error}
                retry={() => {
                  if (exportFile.variables) exportFile.mutate(exportFile.variables);
                }}
              />
            )}
            {report.data && filters && !report.isError && (
              <section aria-label="Enrollment report results" className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-brand-maroon text-2xl font-bold">
                      {report.data.total.toLocaleString("en-PH")} enrollment records
                    </p>
                    <p className="text-brand-muted mt-1 text-sm break-words">{label(filters)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(["csv", "pdf"] as const).map((format) => (
                      <button
                        key={format}
                        type="button"
                        className={adminButton}
                        disabled={busy}
                        onClick={() => exportFile.mutate(format)}
                      >
                        Export {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Group by">
                    <select
                      className={adminField}
                      value={filters.groupBy}
                      disabled={busy}
                      onChange={(event) =>
                        load({ ...filters, groupBy: event.target.value as ReportGroup })
                      }
                    >
                      {Object.entries(groupNames).map(([value, name]) => (
                        <option key={value} value={value}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {filters.programCode && (
                    <>
                      <button
                        type="button"
                        className={adminButton}
                        disabled={busy}
                        onClick={() => load({ ...filters, groupBy: "yearLevel" })}
                      >
                        View year levels
                      </button>
                      <button
                        type="button"
                        className={adminButton}
                        disabled={busy}
                        onClick={() => load({ ...filters, groupBy: "section" })}
                      >
                        View sections
                      </button>
                    </>
                  )}
                  {rootFilters && filters.programCode !== rootFilters.programCode && (
                    <button
                      type="button"
                      className={adminButton}
                      disabled={busy}
                      onClick={() => load(rootFilters)}
                    >
                      Back to program summary
                    </button>
                  )}
                </div>
                {report.data.total === 0 ? (
                  <p className={adminCard}>No enrollment records match {label(filters)}.</p>
                ) : (
                  <>
                    <EnrollmentChart
                      report={report.data}
                      groupBy={filters.groupBy}
                      busy={busy}
                      onDrill={(program) =>
                        load({ ...filters, programCode: program, groupBy: "yearLevel" })
                      }
                    />
                    <AdminTable
                      caption="Enrollment counts"
                      headings={[groupNames[filters.groupBy], "Enrollment records"]}
                    >
                      {report.data.rows.map((row) => (
                        <tr key={row.group}>
                          <th scope="row" className="px-4 py-4">
                            {filters.groupBy === "program" &&
                            row.group &&
                            row.group !== "Unknown" ? (
                              <button
                                type="button"
                                className="text-brand-maroon min-h-11 cursor-pointer rounded-sm text-left font-semibold underline underline-offset-4 disabled:opacity-50"
                                disabled={busy}
                                onClick={() =>
                                  load({ ...filters, programCode: row.group, groupBy: "yearLevel" })
                                }
                              >
                                {row.group}
                                <span className="sr-only">: view year levels and sections</span>
                              </button>
                            ) : (
                              row.group || "Unspecified"
                            )}
                          </th>
                          <td className="px-4 py-4">{row.count.toLocaleString("en-PH")}</td>
                        </tr>
                      ))}
                      <tr className="bg-brand-surface font-bold">
                        <th scope="row" className="px-4 py-4">
                          Total
                        </th>
                        <td className="px-4 py-4">{report.data.total.toLocaleString("en-PH")}</td>
                      </tr>
                    </AdminTable>
                  </>
                )}
              </section>
            )}
          </section>
        </>
      )}
    </AdminPage>
  );
}
