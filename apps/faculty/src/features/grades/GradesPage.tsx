import { ApiError } from "@cbpupsis/shared/api";
import {
  GradeValidationError,
  gradingErrorMessage,
  normalizeGrade,
  type FacultyGradeSheet,
  type GradeDeadline,
  type GradeDraftInput,
  type GradeFinalization,
} from "@cbpupsis/shared/grades";
import { ModalDialog, NotFoundPage } from "@cbpupsis/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useBlocker } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useMe } from "../sign-in/useFacultyAuth";
import { facultyGradingDataSource, type FacultyGradingDataSource } from "./dataSource";
import { gradeButton, gradeCard, gradeDate, gradeField, gradePrimary } from "./gradeStyles";

export function GradesPage({
  sectionId,
  dataSource = facultyGradingDataSource,
}: {
  sectionId: string;
  dataSource?: FacultyGradingDataSource;
}) {
  const me = useMe();
  const [generation, setGeneration] = useState(0);
  const query = useQuery({
    queryKey: ["faculty-grading", me.data?.id, sectionId],
    queryFn: async ({ signal }) => {
      const [sheet, deadline] = await Promise.all([
        dataSource.sheet(sectionId, signal),
        dataSource.deadline(sectionId, signal),
      ]);
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
        <nav aria-label="Breadcrumb" className="text-brand-muted text-sm">
          <Link to="/grades" className="underline">
            Grades
          </Link>{" "}
          / Submission
        </nav>
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
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "finalize" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [passed, setPassed] = useState(deadline.passed);
  const [receipt, setReceipt] = useState<GradeFinalization | null>(null);
  const running = useRef(false);
  const revision = useRef(0);
  const alive = useRef(true);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const latestSave = useRef<() => void>(() => {});
  const readOnly = sheet.state === "FINAL" || locked;
  const dirty =
    !readOnly && sheet.rows.some((row) => (marks[row.studentId] ?? "") !== (row.mark ?? ""));
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
      const mark = raw ? normalizeGrade(raw) : null;
      if ((raw && !mark) || (requireAll && !mark))
        errors[row.studentId] = "Enter a mark from 1.00 to 5.00, or INC.";
      return { studentId: row.studentId, mark };
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
        if (error.code === "VERSION_CONFLICT") setBlocked(true);
        if (error.code === "GRADE_DEADLINE_PASSED") {
          setPassed(true);
          setFailure(null);
        }
        if (error.code === "GRADES_LOCKED") {
          setLocked(true);
          try {
            const current = await dataSource.sheet(sheet.section.id);
            if (alive.current) setSheet(current);
          } catch {
            /* Keep all writing locked even if reloading fails. */
          }
        }
      }
    },
    [dataSource, sheet.section.id],
  );
  const save = useCallback(
    async (automatic = false) => {
      if (running.current || readOnly || blocked || !dirty) return;
      const errors: Record<string, string> = {};
      const grades = sheet.rows.map((row) => {
        const raw = (marks[row.studentId] ?? "").trim();
        const mark = raw ? normalizeGrade(raw) : null;
        if (raw && !mark) errors[row.studentId] = "Enter a mark from 1.00 to 5.00, or INC.";
        return { studentId: row.studentId, mark };
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
        if (revision.current === captured)
          setMarks(Object.fromEntries(saved.rows.map((row) => [row.studentId, row.mark ?? ""])));
        setMessage(saved.savedAt ? `Draft saved at ${gradeDate(saved.savedAt)}.` : "Draft saved.");
      } catch (error) {
        await handleFailure(error);
      } finally {
        running.current = false;
        if (alive.current) setBusy(null);
      }
    },
    [blocked, dataSource, dirty, handleFailure, marks, readOnly, sheet],
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
    if (running.current || readOnly || blocked || passed) return;
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
  const counts = ["1", "2", "3", "4", "5", "INC"].map((label) => ({
    label,
    count: Object.values(marks).filter((value) => {
      const mark = normalizeGrade(value);
      return label === "INC" ? mark === "INC" : mark !== "INC" && mark?.startsWith(label);
    }).length,
  }));
  const marked = Object.values(marks).filter((mark) => normalizeGrade(mark)).length;
  return (
    <>
      <section className={gradeCard} aria-label="Section and submission status">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-brand-muted text-sm">
              {sheet.section.termLabel} · {sheet.section.sectionName}
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {sheet.section.courseCode}: {sheet.section.courseTitle}
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
      <section className={gradeCard} aria-labelledby="distribution-heading">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 id="distribution-heading" className="font-bold">
            Grade distribution
          </h2>
          <p className="text-brand-muted text-sm">
            {marked} of {sheet.rows.length} students marked
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {counts.map(({ label, count }) => (
            <div className="bg-brand-paper rounded-lg p-3 text-center" key={label}>
              <dt className="text-brand-muted text-xs">
                {label === "INC"
                  ? "Incomplete"
                  : label === "5"
                    ? "5.00"
                    : `${label}.00–${label}.99`}
              </dt>
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
              Enter 1.00–5.00 or INC. Drafts save automatically every 60 seconds.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className={gradeButton}
              disabled={!dirty || readOnly || blocked || !!busy}
              onClick={() => void save()}
            >
              {busy === "save" ? "Saving draft…" : "Save draft"}
            </button>
            <button
              className={gradePrimary}
              disabled={!sheet.rows.length || readOnly || blocked || passed || !!busy}
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
        {failure && (
          <div role="alert" className="text-brand-maroon mb-4 text-sm">
            <p>{failure}</p>
            {blocked && (
              <button
                className={gradeButton + " mt-3"}
                onClick={() => {
                  if (
                    !dirty ||
                    window.confirm("Reload and discard the unsaved changes in this window?")
                  )
                    void onReload();
                }}
              >
                Reload grades
              </button>
            )}
          </div>
        )}
        {sheet.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Grades for {sheet.section.courseCode}, {sheet.section.sectionName}
              </caption>
              <thead className="bg-brand-maroon text-white">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Student
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Student number
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Mark
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Inc completion deadline
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheet.rows.map((row, index) => (
                  <tr className="border-brand-border/25 border-b" key={row.studentId}>
                    <th scope="row" className="px-4 py-4 font-semibold">
                      {row.studentName}
                    </th>
                    <td className="px-4 py-4">{row.studentNumber}</td>
                    <td className="w-44 px-4 py-4">
                      <input
                        ref={(element) => {
                          if (element) inputs.current.set(row.studentId, element);
                          else inputs.current.delete(row.studentId);
                        }}
                        aria-label={`Grade for ${row.studentName} (${row.studentNumber})`}
                        aria-invalid={!!fields[row.studentId]}
                        aria-describedby={`grade-mark-help${fields[row.studentId] ? ` mark-error-${index}` : ""}`}
                        value={marks[row.studentId] ?? ""}
                        readOnly={readOnly || blocked || busy === "finalize"}
                        autoComplete="off"
                        list="grade-values"
                        className={gradeField + (fields[row.studentId] ? " border-red-700!" : "")}
                        onChange={(event) => {
                          revision.current++;
                          setMarks((current) => ({
                            ...current,
                            [row.studentId]: event.target.value,
                          }));
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
                    <td className="px-4 py-4 text-xs">
                      {row.completionDeadline
                        ? gradeDate(row.completionDeadline)
                        : normalizeGrade(marks[row.studentId] ?? "") === "INC"
                          ? "Provided when the draft is saved"
                          : "—"}
                    </td>
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
        <datalist id="grade-values">
          {[
            "1.00",
            "1.25",
            "1.50",
            "1.75",
            "2.00",
            "2.25",
            "2.50",
            "2.75",
            "3.00",
            "4.00",
            "5.00",
            "INC",
          ].map((value) => (
            <option value={value} key={value} />
          ))}
        </datalist>
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
