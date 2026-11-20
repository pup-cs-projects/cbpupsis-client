import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import {
  ENROLLMENT_STATUSES,
  GRADE_STATUSES,
  type RosterEntry,
  type RosterFilters,
} from "@cbpupsis/shared/sections/faculty";
import { ModalDialog, NotFoundPage } from "@cbpupsis/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { facultySectionsApi, session } from "../../lib/auth";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { gradeButton, gradeCard, gradeField, gradePrimary } from "../grades/gradeStyles";
import { useCourseLabel } from "../sections/courseLabels";
import { useMe } from "../sign-in/useFacultyAuth";

const label = (value: string) =>
  value === "INC"
    ? "INC"
    : value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^./, (s) => s.toUpperCase());
export function RosterPage({ sectionId }: { sectionId: string }) {
  const me = useMe();
  const [filters, setFilters] = useState<RosterFilters>({});
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const running = useRef(false);
  const query = useQuery({
    queryKey: ["faculty-roster", me.data?.id, sectionId, filters, offset],
    queryFn: ({ signal }) =>
      session.authorized((token) =>
        facultySectionsApi.roster(token, sectionId, filters, offset, signal),
      ),
    enabled: me.isSuccess,
    retry: false,
  });
  // Cache only: the dashboard and section cards already resolved the course for this section.
  const course = useCourseLabel(sectionId, me.data?.id, { enabled: false });
  const error = me.error ?? query.error;
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  const data = query.data;
  function change(next: RosterFilters) {
    setSelected(null);
    setFilters(next);
    setOffset(0);
    setExportError(null);
  }
  async function exportCsv() {
    if (running.current) return;
    running.current = true;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await session.authorized((token) =>
        facultySectionsApi.exportCsv(token, sectionId, filters),
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `section-${sectionId}-roster.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setExportError(failure);
    } finally {
      running.current = false;
      setExporting(false);
    }
  }
  const detailButton = (row: RosterEntry) => (
    <button
      className="text-brand-maroon cursor-pointer text-left font-semibold underline decoration-transparent underline-offset-4 hover:decoration-current"
      onClick={() => setSelected(row.studentId)}
      aria-label={`View teaching details for ${row.name}`}
    >
      {row.name}
    </button>
  );
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <header>
          <Link className="text-brand-muted text-sm underline" to="/sections">
            Assigned sections
          </Link>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold">
            {["Class roster", course.data?.courseCode, data?.sectionName]
              .filter(Boolean)
              .join(" · ")}
          </h1>
          <p className="text-brand-muted mt-2 text-sm">
            Review enrollment, grades, and add/drop activity for your class.
          </p>
        </header>
        {error ? (
          <div className={gradeCard} role="alert">
            <p>{errorMessage(error)}</p>
            <button
              className={gradeButton + " mt-3"}
              onClick={() => void (me.isError ? me.refetch() : query.refetch())}
            >
              Retry roster
            </button>
          </div>
        ) : (
          <>
            <section className={gradeCard} aria-label="Roster filters">
              <div className="flex flex-wrap items-end gap-4">
                <label className="w-full min-w-0 text-sm font-medium sm:w-auto sm:flex-1">
                  Enrollment status
                  <select
                    className={gradeField + " mt-2"}
                    value={filters.enrollmentStatus ?? ""}
                    onChange={(e) =>
                      change({
                        ...filters,
                        enrollmentStatus:
                          (e.target.value as RosterFilters["enrollmentStatus"]) || undefined,
                      })
                    }
                  >
                    <option value="">All enrollment statuses</option>
                    {ENROLLMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="w-full min-w-0 text-sm font-medium sm:w-auto sm:flex-1">
                  Grade status
                  <select
                    className={gradeField + " mt-2"}
                    value={filters.gradeStatus ?? ""}
                    onChange={(e) =>
                      change({
                        ...filters,
                        gradeStatus: (e.target.value as RosterFilters["gradeStatus"]) || undefined,
                      })
                    }
                  >
                    <option value="">All grade statuses</option>
                    {GRADE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className={gradeButton} onClick={() => change({})}>
                  Clear filters
                </button>
                <button
                  className={gradePrimary}
                  disabled={query.isPending || exporting}
                  onClick={() => void exportCsv()}
                >
                  {exporting ? "Exporting CSV…" : exportError ? "Retry CSV export" : "Export CSV"}
                </button>
              </div>
              {exporting && (
                <p role="status" className="mt-3 text-sm">
                  Preparing the filtered roster…
                </p>
              )}
              {!!exportError && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  Export failed. {errorMessage(exportError)} Retry the CSV export.
                </p>
              )}
            </section>
            {query.isPending ? (
              <p role="status">Loading class roster…</p>
            ) : (
              data && (
                <section className={gradeCard} aria-label="Class roster">
                  <p role="status" aria-live="polite" className="text-brand-muted mb-4 text-sm">
                    Showing {data.roster.length ? data.offset + 1 : 0} to{" "}
                    {data.offset + data.roster.length} of {data.total} students
                  </p>
                  {!data.roster.length ? (
                    <p className="py-6">
                      {filters.enrollmentStatus || filters.gradeStatus
                        ? "No students match these filters"
                        : "No students are enrolled yet"}
                    </p>
                  ) : (
                    <>
                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full text-left text-sm">
                          <caption className="sr-only">Students in {data.sectionName}</caption>
                          <thead className="bg-brand-maroon text-white">
                            <tr>
                              {[
                                "Student",
                                "Student number",
                                "Email",
                                "Enrollment",
                                "Grade status",
                                "Add/drop status",
                              ].map((s) => (
                                <th scope="col" className="px-4 py-3" key={s}>
                                  {s}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {data.roster.map((row) => (
                              <tr key={row.studentId} className="border-brand-border/25 border-b">
                                <th scope="row" className="px-4 py-4">
                                  {detailButton(row)}
                                </th>
                                <td className="px-4 py-4">{row.studentNumber}</td>
                                <td className="px-4 py-4 break-all">{row.email}</td>
                                <td className="px-4 py-4">{label(row.enrollmentStatus)}</td>
                                <td className="px-4 py-4">{label(row.gradeStatus)}</td>
                                <td className="px-4 py-4">{label(row.addDropStatus)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <ul className="space-y-4 md:hidden">
                        {data.roster.map((row) => (
                          <li
                            className="border-brand-border/25 rounded-xl border p-4"
                            key={row.studentId}
                          >
                            {detailButton(row)}
                            <dl className="mt-3 grid gap-3 text-sm">
                              {[
                                ["Student number", row.studentNumber],
                                ["Email", row.email],
                                ["Enrollment", label(row.enrollmentStatus)],
                                ["Grade status", label(row.gradeStatus)],
                                ["Add/drop status", label(row.addDropStatus)],
                              ].map(([key, value]) => (
                                <div key={key}>
                                  <dt className="text-brand-muted text-xs">{key}</dt>
                                  <dd className="mt-1 break-words">{value}</dd>
                                </div>
                              ))}
                            </dl>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      className={gradeButton}
                      disabled={offset === 0 || query.isFetching}
                      onClick={() => {
                        setSelected(null);
                        setOffset(Math.max(0, offset - 20));
                      }}
                    >
                      Previous
                    </button>
                    <button
                      className={gradeButton}
                      disabled={offset + data.roster.length >= data.total || query.isFetching}
                      onClick={() => {
                        setSelected(null);
                        setOffset(offset + 20);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </section>
              )
            )}
          </>
        )}
        {selected && me.data && (
          <StudentDetails
            key={`${me.data.id}:${sectionId}:${selected}`}
            sectionId={sectionId}
            studentId={selected}
            owner={me.data.id}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
function StudentDetails({
  sectionId,
  studentId,
  owner,
  onClose,
}: {
  sectionId: string;
  studentId: string;
  owner: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["faculty-student", owner, sectionId, studentId],
    queryFn: ({ signal }) =>
      session.authorized((token) =>
        facultySectionsApi.student(token, sectionId, studentId, signal),
      ),
    retry: false,
  });
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  return (
    <ModalDialog open title="Student teaching details" onClose={onClose}>
      {query.isPending ? (
        <p role="status" className="mt-4">
          Loading student details…
        </p>
      ) : query.error ? (
        <div className="mt-4" role="alert">
          <p>
            {notFound
              ? "This student is not available in this section."
              : errorMessage(query.error)}
          </p>
          {!notFound && (
            <button className={gradeButton + " mt-3"} onClick={() => void query.refetch()}>
              Retry student details
            </button>
          )}
        </div>
      ) : (
        query.data && (
          <dl className="mt-5 space-y-4">
            {[
              ["Name", query.data.name],
              ["Student number", query.data.studentNumber],
              ["Email", query.data.email],
              ["Program", query.data.program],
              ["Year level", String(query.data.yearLevel)],
            ].map(([key, value]) => (
              <div key={key}>
                <dt className="text-brand-muted text-xs">{key}</dt>
                <dd className="mt-1 font-medium break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )
      )}
      <button className={gradeButton + " mt-6"} onClick={onClose}>
        Close details
      </button>
    </ModalDialog>
  );
}
