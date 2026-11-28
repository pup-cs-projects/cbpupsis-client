import { ApiError } from "@cbpupsis/shared/api";
import {
  GradeValidationError,
  gradingErrorMessage,
  type GradeDeadline,
  type GradeDraftInput,
  type GradeFinalization,
} from "@cbpupsis/shared/grades";
import { ModalDialog, NotFoundPage } from "@cbpupsis/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { rememberCourseLabel } from "../sections/courseLabels";
import { useMe } from "../sign-in/useFacultyAuth";
import { facultyGradingDataSource, type FacultyGradingDataSource } from "./dataSource";
import { gradeButton, gradeCard, gradeDate, gradeField, gradePrimary } from "./gradeStyles";
import { Breadcrumb } from "../../components/Breadcrumb";
import { GradeMarkInput } from "./GradeMarkInput";
import { gradeDistribution, gradePolicy, type FacultyGradeSheet } from "./gradingMode";

export function GradesPage({
  sectionId,
  dataSource = facultyGradingDataSource,
}: {
  sectionId: string;
  dataSource?: FacultyGradingDataSource;
}) {
  const me = useMe();
  const client = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const query = useQuery({
    queryKey: ["faculty-grading", me.data?.id, sectionId],
    queryFn: async ({ signal }) => {
      const [sheet, deadline] = await Promise.all([
        dataSource.sheet(sectionId, signal),
        dataSource.deadline(sectionId, signal),
      ]);
      if (sheet.section.id === sectionId)
        rememberCourseLabel(
          client,
          me.data?.id,
          sectionId,
          sheet.section.courseCode,
          sheet.section.courseTitle,
        );
      return { sheet, deadline };
    },
    enabled: me.isSuccess,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const error = me.error ?? query.error;
  if (error instanceof ApiError && error.status === 404) return <NotFoundPage />;
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <Breadcrumb items={[{ label: "Grades", to: "/grades" }, { label: "Grade Submission" }]} />
        <h1 className="text-brand-maroon text-3xl font-bold">Grade submission</h1>
        {error ? (
          <div role="alert" className={gradeCard}>
            <p>{gradingErrorMessage(error)}</p>
            <button
              className={gradeButton + " mt-4"}
              onClick={() => void (me.isError ? me.refetch() : query.refetch())}
            >
              Retry grades
            </button>
          </div>
        ) : !me.isSuccess || !query.data ? (
          <p role="status">Loading section grades…</p>
        ) : (
          <GradeEditor
            key={`${me.data.id}:${sectionId}:${generation}`}
            initial={query.data.sheet}
            deadline={query.data.deadline}
            dataSource={dataSource}
            onReload={async () => {
              const result = await query.refetch();
              if (result.isSuccess) setGeneration((value) => value + 1);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function GradeEditor({
  initial,
  deadline,
  dataSource,
  onReload,
}: {
  initial: FacultyGradeSheet;
  deadline: GradeDeadline;
  dataSource: FacultyGradingDataSource;
  onReload: () => Promise<void>;
}) {
  const [sheet, setSheet] = useState(initial);
  const [marks, setMarks] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.rows.map((row) => [row.studentId, row.mark ?? ""])),
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  // INC completion deadlines the faculty picked (YYYY-MM-DD, Manila), keyed by student.
  const [deadlines, setDeadlines] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "finalize" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [modeRefreshed, setModeRefreshed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockRefreshFailed, setLockRefreshFailed] = useState(false);
  const [passed, setPassed] = useState(deadline.passed);
  const [receipt, setReceipt] = useState<GradeFinalization | null>(null);
  const running = useRef(false);
  const revision = useRef(0);
  const alive = useRef(true);
  const inputs = useRef(new Map<string, HTMLInputElement | HTMLSelectElement>());
  const latestSave = useRef<() => void>(() => {});
  const policy = gradePolicy(sheet);
  const readOnly = sheet.state === "FINAL" || locked;
  const incRange = incDeadlineRange();
  const dirty =
    !readOnly &&
    sheet.rows.some(
      (row) =>
        (marks[row.studentId] ?? "") !== (row.mark ?? "") ||
        (policy.normalize(marks[row.studentId] ?? "") === "INC" &&
          pickedDeadline(deadlines, row) !== null),
    );
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: dirty,
    withResolver: true,
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  function entries(requireAll: boolean): GradeDraftInput["grades"] | null {
    const errors: Record<string, string> = {};
    const grades = sheet.rows.map((row) => {
      const raw = (marks[row.studentId] ?? "").trim();
      const mark = raw ? policy.normalize(raw) : null;
      if ((raw && !mark) || (requireAll && !mark)) errors[row.studentId] = policy.validationMessage;
      const completionDeadline = mark === "INC" ? pickedDeadline(deadlines, row) : null;
      if (completionDeadline && !incRange.allows(completionDeadline))
        errors[row.studentId] = incRange.message;
      return completionDeadline
        ? { studentId: row.studentId, mark, completionDeadline }
        : { studentId: row.studentId, mark };
    });
    setFields(errors);
    if (Object.keys(errors).length) {
      inputs.current.get(Object.keys(errors)[0]!)?.focus();
      return null;
    }
    return grades;
  }
  const handleFailure = useCallback(
    async (error: unknown) => {
      if (!alive.current) return;
      setFailure(gradingErrorMessage(error));
      if (error instanceof GradeValidationError) setFields(error.fields);
      if (error instanceof ApiError) {
        if (error.code === "VERSION_CONFLICT") {
          setBlocked(true);
          setModeRefreshed(false);
        }
        if (error.code === "GRADE_MODE_MISMATCH") {
          setBlocked(true);
          setModeRefreshed(false);
          const modeMessage = (mode: unknown) =>
            mode === "PASS_FAIL"
              ? "This section is graded Pass or Fail. Choose an allowed Pass or Fail mark."
              : mode === "NUMERIC"
                ? "This section uses numeric grades. Choose an allowed numeric mark."
                : "The mark does not match this section’s grading mode.";
          setFailure(modeMessage(error.details?.gradingMode));
          try {
            const current = await dataSource.sheet(sheet.section.id);
            if (!alive.current) return;
            const updated = gradePolicy(current);
            setSheet(current);
            setMarks((previous) =>
              Object.fromEntries(
                current.rows.map((row) => [
                  row.studentId,
                  updated.normalize(previous[row.studentId] ?? row.mark ?? "") ?? "",
                ]),
              ),
            );
            setFields({});
            setModeRefreshed(updated.ready);
            setFailure(
              modeMessage(current.gradingMode) +
                " The latest allowed marks have been loaded. Review them before saving again.",
            );
          } catch {
            // Keep writes paused until an explicit reload succeeds. Never replay the write.
          }
        }
        if (error.code === "GRADE_DEADLINE_PASSED") {
          setPassed(true);
          setFailure(null);
        }
        if (error.code === "GRADES_LOCKED") {
          setLocked(true);
          try {
            const current = await dataSource.sheet(sheet.section.id);
            if (alive.current) {
              setSheet(current);
              setMarks(
                Object.fromEntries(current.rows.map((row) => [row.studentId, row.mark ?? ""])),
              );
              setLockRefreshFailed(false);
            }
          } catch {
            if (alive.current) setLockRefreshFailed(true);
          }
        }
      }
    },
    [dataSource, sheet.section.id],
  );
  const save = useCallback(
    async (automatic = false) => {
      if (running.current || readOnly || blocked || !policy.ready || !dirty) return;
      const errors: Record<string, string> = {};
      const grades = sheet.rows.map((row) => {
        const raw = (marks[row.studentId] ?? "").trim();
        const mark = raw ? policy.normalize(raw) : null;
        if (raw && !mark) errors[row.studentId] = policy.validationMessage;
        const completionDeadline = mark === "INC" ? pickedDeadline(deadlines, row) : null;
        const range = incDeadlineRange();
        if (completionDeadline && !range.allows(completionDeadline))
          errors[row.studentId] = range.message;
        return completionDeadline
          ? { studentId: row.studentId, mark, completionDeadline }
          : { studentId: row.studentId, mark };
      });
      if (Object.keys(errors).length) {
        if (!automatic) {
          setFields(errors);
          inputs.current.get(Object.keys(errors)[0]!)?.focus();
        }
        return;
      }
      running.current = true;
      setBusy("save");
      setFailure(null);
      setFields({});
      const captured = revision.current;
      try {
        const saved = await dataSource.saveDraft(sheet.section.id, {
          version: sheet.version,
          grades,
        });
        if (!alive.current) return;
        setSheet(saved);
        if (revision.current === captured) {
          setMarks(Object.fromEntries(saved.rows.map((row) => [row.studentId, row.mark ?? ""])));
          setDeadlines({});
        }
        setMessage(saved.savedAt ? `Draft saved at ${gradeDate(saved.savedAt)}.` : "Draft saved.");
      } catch (error) {
        await handleFailure(error);
      } finally {
        running.current = false;
        if (alive.current) setBusy(null);
      }
    },
    [blocked, dataSource, dirty, handleFailure, marks, policy, readOnly, sheet, deadlines],
  );
  useEffect(() => {
    latestSave.current = () => {
      void save(true);
    };
  }, [save]);
  useEffect(() => {
    const timer = window.setInterval(() => latestSave.current(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function finalize() {
    if (running.current || readOnly || blocked || !policy.ready || passed) return;
    const grades = entries(true);
    if (!grades) {
      setConfirming(false);
      return;
    }
    running.current = true;
    setBusy("finalize");
    setFailure(null);
    try {
      const currentDeadline = await dataSource.deadline(sheet.section.id);
      if (currentDeadline.passed) {
        setPassed(true);
        setConfirming(false);
        return;
      }
      let current = sheet;
      if (dirty)
        current = await dataSource.saveDraft(sheet.section.id, { version: sheet.version, grades });
      if (!alive.current) return;
      setSheet(current);
      const result = await dataSource.finalize(sheet.section.id, current.version);
      if (!alive.current) return;
      setSheet({
        ...current,
        state: "FINAL",
        version: result.version,
        finalizedAt: result.finalizedAt,
      });
      setMarks(Object.fromEntries(current.rows.map((row) => [row.studentId, row.mark ?? ""])));
      setReceipt(result);
      setMessage("Grades submitted successfully. These grades are final.");
      setConfirming(false);
    } catch (error) {
      await handleFailure(error);
      setConfirming(false);
    } finally {
      running.current = false;
      if (alive.current) setBusy(null);
    }
  }
  const counts = gradeDistribution(policy, Object.values(marks));
  const marked = Object.values(marks).filter((mark) => policy.normalize(mark)).length;
  return (
    <>
      <section className={gradeCard} aria-label="Section and submission status">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-brand-muted text-sm">
              {[sheet.section.termLabel, sheet.section.sectionName].filter(Boolean).join(" · ")}
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {[sheet.section.courseCode, sheet.section.courseTitle].filter(Boolean).join(": ") ||
                sheet.section.sectionName}
            </h2>
          </div>
          <span className="rounded border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-semibold">
            {readOnly ? "Final" : "Draft"}
          </span>
        </div>
        <p className="text-brand-muted mt-4 text-sm">
          Submission deadline (Manila):{" "}
          <time dateTime={deadline.deadline ?? undefined}>{gradeDate(deadline.deadline)}</time>
        </p>
        {passed && (
          <p role="alert" className="text-brand-maroon mt-3 text-sm font-semibold">
            The deadline has passed. Ask an administrator for an override.
          </p>
        )}
        {readOnly && !locked && (
          <p className="mt-3 text-sm">
            These grades are final. Use Correction of Entry to change one.
          </p>
        )}
        {receipt && (
          <p className="mt-3 text-sm">
            {receipt.recordsCommitted} records committed · {receipt.notificationsQueued}{" "}
            notifications queued.
          </p>
        )}
      </section>
      {lockRefreshFailed && (
        <div role="alert" className={gradeCard}>
          <p>
            Final grades could not be reloaded. These are the last loaded marks; editing remains
            locked.
          </p>
          <button className={gradeButton + " mt-3"} onClick={() => void onReload()}>
            Reload final grades
          </button>
        </div>
      )}
      <section className={gradeCard} aria-labelledby="distribution-heading">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 id="distribution-heading" className="font-bold">
            Grade distribution
          </h2>
          <p className="text-brand-muted text-sm">
            {marked} of {sheet.rows.length} students marked
          </p>
        </div>
        <dl
          className={
            policy.mode === "PASS_FAIL"
              ? "mt-4 grid grid-cols-2 gap-3"
              : "mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5"
          }
        >
          {counts.map(({ label, count }) => (
            <div className="bg-brand-paper rounded-lg p-3 text-center" key={label}>
              <dt className="text-brand-muted text-xs">{label}</dt>
              <dd className="text-brand-maroon mt-1 text-xl font-bold">{count}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={gradeCard} aria-label="Student grade grid">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Student grades</h2>
            <p id="grade-mark-help" className="text-brand-muted mt-1 text-sm">
              {policy.mode === "PASS_FAIL"
                ? "This section is graded Pass or Fail."
                : policy.mode === "NUMERIC"
                  ? "This section uses numeric grades."
                  : "Grading mode is unavailable."}{" "}
              {policy.mode === "NUMERIC" &&
                (policy.allowedMarks.includes("INC")
                  ? "Enter an allowed numeric mark or INC. "
                  : "Enter an allowed numeric mark. ")}
              Drafts save automatically every 60 seconds.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={gradeButton}
              disabled={!dirty || readOnly || blocked || !policy.ready || !!busy}
              onClick={() => void save()}
            >
              {busy === "save" ? "Saving draft…" : "Save draft"}
            </button>
            <button
              className={gradePrimary}
              disabled={
                !sheet.rows.length || readOnly || blocked || !policy.ready || passed || !!busy
              }
              onClick={() => {
                if (entries(true)) setConfirming(true);
              }}
            >
              {busy === "finalize" ? "Submitting…" : "Submit final grades"}
            </button>
          </div>
        </div>
        <p role="status" className="text-brand-muted mb-3 text-sm">
          {busy === "save"
            ? "Saving your draft…"
            : dirty
              ? "Unsaved changes"
              : (message ??
                (sheet.savedAt
                  ? `Draft saved at ${gradeDate(sheet.savedAt)}.`
                  : "No unsaved changes"))}
        </p>
        {!policy.ready && (
          <div role="alert" className="text-brand-maroon mb-4 text-sm">
            <p>
              The grading mode or allowed marks could not be confirmed. Reload grades before
              editing.
            </p>
            <button className={gradeButton + " mt-3"} onClick={() => void onReload()}>
              Reload grades
            </button>
          </div>
        )}
        {failure && (
          <div role="alert" className="text-brand-maroon mb-4 text-sm">
            <p>{failure}</p>
            {blocked && policy.ready && (
              <button
                className={gradeButton + " mt-3"}
                onClick={() => {
                  if (modeRefreshed) {
                    setBlocked(false);
                    setModeRefreshed(false);
                    setFailure(null);
                    return;
                  }
                  if (
                    !dirty ||
                    window.confirm("Reload and discard the unsaved changes in this window?")
                  )
                    void onReload();
                }}
              >
                {modeRefreshed ? "Review updated marks" : "Reload grades"}
              </button>
            )}
          </div>
        )}
        {sheet.rows.length ? (
          <div className="overflow-x-auto">
            <table
              className={
                policy.mode === "PASS_FAIL"
                  ? "w-full table-fixed border-collapse text-left text-sm"
                  : "w-full min-w-[560px] border-collapse text-left text-sm"
              }
            >
              <caption className="sr-only">
                Grades for {sheet.section.courseCode}, {sheet.section.sectionName}
              </caption>
              <thead className="bg-brand-maroon text-white">
                <tr>
                  <th
                    scope="col"
                    className={
                      policy.mode === "PASS_FAIL" ? "w-1/2 px-2 py-3 sm:px-4" : "px-4 py-3"
                    }
                  >
                    Student
                  </th>
                  <th
                    scope="col"
                    className={
                      policy.mode === "PASS_FAIL" ? "hidden px-4 py-3 sm:table-cell" : "px-4 py-3"
                    }
                  >
                    Student number
                  </th>
                  <th
                    scope="col"
                    className={policy.mode === "PASS_FAIL" ? "px-2 py-3 sm:px-4" : "px-4 py-3"}
                  >
                    Mark
                  </th>
                  {policy.mode !== "PASS_FAIL" && (
                    <th scope="col" className="px-4 py-3">
                      INC completion deadline
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, index) => (
                  <tr className="border-brand-border/25 border-b" key={row.studentId}>
                    <th
                      scope="row"
                      className={
                        policy.mode === "PASS_FAIL"
                          ? "px-2 py-4 font-semibold break-words sm:px-4"
                          : "px-4 py-4 font-semibold"
                      }
                    >
                      {row.studentName}
                      {policy.mode === "PASS_FAIL" && (
                        <span className="mt-1 block text-xs font-normal sm:hidden">
                          {row.studentNumber}
                        </span>
                      )}
                    </th>
                    <td
                      className={
                        policy.mode === "PASS_FAIL" ? "hidden px-4 py-4 sm:table-cell" : "px-4 py-4"
                      }
                    >
                      {row.studentNumber}
                    </td>
                    <td
                      className={
                        policy.mode === "PASS_FAIL" ? "px-2 py-4 sm:px-4" : "w-44 px-4 py-4"
                      }
                    >
                      <GradeMarkInput
                        policy={policy}
                        studentName={row.studentName}
                        studentNumber={row.studentNumber}
                        error={!!fields[row.studentId]}
                        errorId={`mark-error-${index}`}
                        value={marks[row.studentId] ?? ""}
                        readOnly={readOnly || blocked || !policy.ready || busy === "finalize"}
                        fieldRef={(element) => {
                          if (element) inputs.current.set(row.studentId, element);
                          else inputs.current.delete(row.studentId);
                        }}
                        onChange={(value) => {
                          revision.current++;
                          setMarks((current) => ({ ...current, [row.studentId]: value }));
                          setFields((current) => ({ ...current, [row.studentId]: "" }));
                          setMessage(null);
                        }}
                      />
                      {fields[row.studentId] && (
                        <p
                          id={`mark-error-${index}`}
                          role="alert"
                          className="mt-1 text-xs text-red-700"
                        >
                          {fields[row.studentId]}
                        </p>
                      )}
                    </td>
                    {policy.mode !== "PASS_FAIL" && (
                      <td className="px-4 py-4 text-xs">
                        {policy.normalize(marks[row.studentId] ?? "") === "INC" &&
                        !(readOnly || blocked || !policy.ready || busy === "finalize") ? (
                          <>
                            <input
                              type="date"
                              aria-label={`INC completion deadline for ${row.studentName}`}
                              aria-describedby={`inc-deadline-help-${index}`}
                              min={incRange.min}
                              max={incRange.max}
                              value={
                                deadlines[row.studentId] ??
                                manilaDate(row.completionDeadline) ??
                                incRange.max
                              }
                              className={gradeField + " w-44"}
                              onChange={(event) => {
                                revision.current++;
                                setDeadlines((current) => ({
                                  ...current,
                                  [row.studentId]: event.target.value,
                                }));
                                setFields((current) => ({ ...current, [row.studentId]: "" }));
                                setMessage(null);
                              }}
                            />
                            <p id={`inc-deadline-help-${index}`} className="text-brand-muted mt-1">
                              {row.completionDeadline
                                ? `Saved: ${gradeDate(row.completionDeadline)}. `
                                : ""}
                              Up to one year from today.
                            </p>
                          </>
                        ) : row.completionDeadline ? (
                          gradeDate(row.completionDeadline)
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-brand-muted py-6 text-sm">
            There are no enrolled students in this section.
          </p>
        )}
      </section>
      <ModalDialog
        open={confirming}
        title="Submit final grades?"
        busy={!!busy}
        onClose={() => setConfirming(false)}
      >
        <p className="mt-4 text-sm leading-relaxed">
          Any unsaved changes will be saved first. Final submission locks this section’s grades and
          makes them available to students. They cannot be edited here afterward.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            data-initial-focus
            className={gradeButton}
            disabled={!!busy}
            onClick={() => setConfirming(false)}
          >
            Keep editing
          </button>
          <button className={gradePrimary} disabled={!!busy} onClick={() => void finalize()}>
            {busy ? "Submitting…" : "Confirm final submission"}
          </button>
        </div>
      </ModalDialog>
      <ModalDialog
        open={blocker.status === "blocked"}
        title="Leave unsaved grades?"
        onClose={() => blocker.reset?.()}
      >
        <p className="mt-4 text-sm">Changes that have not been saved will be lost.</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button data-initial-focus className={gradeButton} onClick={() => blocker.reset?.()}>
            Keep editing grades
          </button>
          <button className={gradePrimary} onClick={() => blocker.proceed?.()}>
            Leave grades
          </button>
        </div>
      </ModalDialog>
    </>
  );
}

const manilaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });
/** An instant as its Manila calendar date (YYYY-MM-DD), or null. */
function manilaDate(value: string | null): string | null {
  return value ? manilaDay.format(new Date(value)) : null;
}
/** The dates a faculty may pick for an INC: today through one year from today (Handbook). */
function incDeadlineRange() {
  const min = manilaDay.format(new Date());
  const [year, month, day] = min.split("-").map(Number) as [number, number, number];
  const max = new Date(Date.UTC(year + 1, month - 1, day)).toISOString().slice(0, 10);
  return {
    min,
    max,
    allows: (value: string) => value >= min && value <= max,
    message: `Choose an INC completion deadline from ${min} to ${max}.`,
  };
}
/** The INC deadline the faculty picked for a row, when it differs from the stored one. */
function pickedDeadline(
  deadlines: Record<string, string>,
  row: { studentId: string; completionDeadline: string | null },
): string | null {
  const picked = deadlines[row.studentId];
  return picked && picked !== manilaDate(row.completionDeadline) ? picked : null;
}
