import { useEffect, useId, useRef, useState } from "react";
import { ApiError } from "@cbpupsis/shared/api";
import {
  canReviewCorrection,
  correctionLabels,
  correctionMark,
  correctionMessage,
  type Correction,
  type CorrectionSection,
  type CorrectionSource,
  type CorrectionStudent,
} from "@cbpupsis/shared/grades/corrections";
const button =
  "focus-visible:outline-offset-0! inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-brand-border/40 bg-white px-4 py-2 text-sm font-semibold hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  button + " bg-brand-maroon! border-brand-maroon! text-white hover:bg-brand-maroon-dark!";
const field =
  "focus-visible:outline-offset-0! border-brand-input-border mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm";
const card = "border-brand-border/25 min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-6";
function Dialog({
  title,
  onClose,
  busy,
  children,
}: {
  title: string;
  onClose: () => void;
  busy: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const node = ref.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node.showModal();
    node.querySelector<HTMLElement>("[data-first]")?.focus();
    return () => {
      node.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="border-brand-border/30 text-brand-ink fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
    >
      <h2 id={id} className="text-brand-maroon text-xl font-bold">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
export function CorrectionWorkspace({
  source,
  ownerId,
  reviewerRole: role,
  faculty = false,
}: {
  source: CorrectionSource;
  ownerId: string;
  reviewerRole: string;
  faculty?: boolean;
}) {
  const allowed = faculty || ["chairperson", "dean", "registrar"].includes(role);
  const [load, setLoad] = useState<{ rows: Correction[]; pending: boolean; error: unknown }>({
    rows: [],
    pending: true,
    error: null,
  });
  const [refresh, setRefresh] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Correction | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [remarks, setRemarks] = useState("");
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const running = useRef(false);
  const alive = useRef(true);
  const detailRequest = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    let active = true;
    async function fetchRows() {
      await Promise.resolve();
      if (!active) return;
      setLoad((current) => ({ ...current, pending: true, error: null }));
      try {
        const rows = await source.list(controller.signal);
        if (active) setLoad({ rows, pending: false, error: null });
      } catch (failure) {
        if (active) {
          if (failure instanceof ApiError && failure.status === 403) setDenied(true);
          setLoad({ rows: [], pending: false, error: failure });
        }
      }
    }
    void fetchRows();
    return () => {
      active = false;
      controller.abort();
    };
  }, [source, ownerId, role, allowed, refresh]);
  async function details(id: string) {
    const request = ++detailRequest.current;
    setSelected(null);
    setError(null);
    setDetailPending(true);
    setBlocked(false);
    setRemarks("");
    setRemarkError(null);
    try {
      const item = await source.detail(id);
      if (alive.current && request === detailRequest.current) setSelected(item);
    } catch (failure) {
      if (alive.current && request === detailRequest.current) {
        setError(correctionMessage(failure));
        if (failure instanceof ApiError && failure.status === 403) setDenied(true);
      }
    } finally {
      if (alive.current && request === detailRequest.current) setDetailPending(false);
    }
  }
  async function decide(action: "ENDORSE" | "COMMIT" | "REJECT") {
    if (!selected || running.current || blocked || !canReviewCorrection(role, ownerId, selected))
      return;
    if (action === "REJECT" && !remarks.trim()) {
      setRemarkError("Remarks are required when rejecting a correction.");
      return;
    }
    running.current = true;
    setBusy(true);
    setError(null);
    setRemarkError(null);
    try {
      const updated = await source.decide(selected.id, {
        action,
        remarks: remarks.trim(),
        version: selected.version,
      });
      if (!alive.current) return;
      setLoad((current) => ({
        ...current,
        rows: current.rows.map((row) => (row.id === updated.id ? updated : row)),
      }));
      setSelected(updated);
      setMessage(
        action === "COMMIT"
          ? "Correction committed. The updated record is available from the server."
          : action === "REJECT"
            ? "Correction rejected. The recorded grade is unchanged."
            : "Correction endorsed for the next approval step.",
      );
    } catch (failure) {
      if (!alive.current) return;
      const text = correctionMessage(failure);
      setError(text);
      if (failure instanceof ApiError) {
        if (failure.code === "DECISION_REMARKS_REQUIRED") setRemarkError(text);
        else if (failure.code === "APPROVAL_SAME_ACTOR") setBlocked(true);
        else if (failure.code === "APPROVAL_OUT_OF_ORDER" || failure.code === "VERSION_CONFLICT") {
          setBlocked(true);
          setRefresh((n) => n + 1);
          const fresh = await source.detail(selected.id).catch(() => null);
          if (alive.current && fresh) {
            setSelected(fresh);
            setBlocked(false);
          }
        } else if (failure.status === 403) setDenied(true);
      }
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  if (!allowed || denied)
    return (
      <section className={card}>
        <p role="alert">This page is not available to your role.</p>
      </section>
    );
  const rows = load.rows.filter(
    (item) =>
      (filter === "all" || item.state === filter) &&
      [item.studentName, item.studentNumber, item.sectionLabel]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const actionable = selected && !blocked && canReviewCorrection(role, ownerId, selected);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        {faculty && (
          <button className={primary} onClick={() => setCreating(true)}>
            New correction
          </button>
        )}
        <button className={button} disabled={load.pending} onClick={() => setRefresh((n) => n + 1)}>
          Refresh corrections
        </button>
      </div>
      {message && (
        <p role="status" className={card}>
          {message}
        </p>
      )}
      {error && !selected && (
        <p role="alert" className="text-brand-maroon">
          {error}
        </p>
      )}
      <section className={card} aria-label="Grade correction records">
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Search corrections
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={field}
            />
          </label>
          <label className="text-sm font-medium">
            Status
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={field}>
              <option value="all">All statuses</option>
              {Object.entries(correctionLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {load.pending ? (
          <p role="status">Loading corrections…</p>
        ) : load.error ? (
          <div role="alert">
            <p>{correctionMessage(load.error)}</p>
            <button className={button + " mt-3"} onClick={() => setRefresh((n) => n + 1)}>
              Retry corrections
            </button>
          </div>
        ) : !rows.length ? (
          <p className="text-brand-muted py-5 text-sm">No corrections match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <caption className="sr-only">Correction of Entry requests</caption>
              <thead className="bg-brand-maroon text-white">
                <tr>
                  {["Student", "Section", "Mark change", "Current step", "Action"].map((text) => (
                    <th key={text} scope="col" className="px-4 py-3">
                      {text}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="border-brand-border/25 border-b">
                    <th scope="row" className="px-4 py-4">
                      {item.studentName}
                      <span className="text-brand-muted mt-1 block text-xs font-normal">
                        {item.studentNumber}
                      </span>
                    </th>
                    <td className="px-4 py-4">{item.sectionLabel}</td>
                    <td className="px-4 py-4">
                      {item.oldMark} → {item.proposedMark}
                    </td>
                    <td className="px-4 py-4">
                      {correctionLabels[item.state]}
                      {item.state === "REJECTED" && item.remarks && (
                        <p className="mt-2 max-w-xs break-words whitespace-pre-wrap">
                          {item.remarks}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        aria-label={"View correction for " + item.studentName}
                        className={button}
                        disabled={detailPending}
                        onClick={() => void details(item.id)}
                      >
                        View correction
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {detailPending && <p role="status">Loading correction details…</p>}
      {creating && (
        <FilingForm
          source={source}
          onClose={() => setCreating(false)}
          onFiled={(item) => {
            setCreating(false);
            setLoad((current) => ({
              ...current,
              error: null,
              pending: false,
              rows: [item, ...current.rows.filter((row) => row.id !== item.id)],
            }));
            setMessage(
              "Correction filed. The recorded grade is unchanged until the Registrar commits it.",
            );
          }}
        />
      )}
      {selected && (
        <Dialog title="Correction details" busy={busy} onClose={() => setSelected(null)}>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-brand-muted">Student</dt>
              <dd>
                {selected.studentName} · {selected.studentNumber}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted">Section</dt>
              <dd>{selected.sectionLabel}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Requested change</dt>
              <dd>
                {selected.oldMark} → {selected.proposedMark}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted">Current step</dt>
              <dd>{correctionLabels[selected.state]}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Reason</dt>
              <dd className="break-words whitespace-pre-wrap">{selected.reason}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Grading sheet</dt>
              <dd className="break-words">
                {safeUrl(selected.sheetUrl) ? (
                  <a
                    href={safeUrl(selected.sheetUrl)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    className="text-brand-maroon underline"
                  >
                    {selected.sheetName}
                  </a>
                ) : (
                  selected.sheetName
                )}
              </dd>
            </div>
            {selected.remarks && (
              <div>
                <dt className="text-brand-muted">Remarks</dt>
                <dd className="break-words whitespace-pre-wrap">{selected.remarks}</dd>
              </div>
            )}
          </dl>
          {!faculty && (
            <>
              <p className="mt-4 text-sm">
                {actionable
                  ? role === "registrar"
                    ? "Committing updates the mark and GWA through the server."
                    : "Endorsement sends this request to the next approver; it does not change the mark."
                  : error
                    ? null
                    : selected.filerId === ownerId || selected.actedBy.includes(ownerId)
                      ? "You already acted on this correction."
                      : "This correction is not at your step."}
              </p>
              {actionable && (
                <label className="mt-4 block text-sm font-medium">
                  Decision remarks
                  <textarea
                    className={field + " min-h-24"}
                    value={remarks}
                    onChange={(e) => {
                      setRemarks(e.target.value);
                      setRemarkError(null);
                    }}
                    disabled={busy}
                    aria-invalid={!!remarkError}
                    aria-describedby="correction-remarks-error"
                  />
                  <span
                    id="correction-remarks-error"
                    role={remarkError ? "alert" : undefined}
                    className="mt-1 block text-xs text-red-700"
                  >
                    {remarkError}
                  </span>
                </label>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="text-brand-maroon mt-3 text-sm">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button data-first className={button} disabled={busy} onClick={() => setSelected(null)}>
              Close correction
            </button>
            {!faculty && actionable && (
              <>
                <button className={button} disabled={busy} onClick={() => void decide("REJECT")}>
                  Reject
                </button>
                <button
                  className={primary}
                  disabled={busy}
                  onClick={() => void decide(role === "registrar" ? "COMMIT" : "ENDORSE")}
                >
                  {busy
                    ? "Saving decision…"
                    : role === "registrar"
                      ? "Commit correction"
                      : "Endorse"}
                </button>
              </>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === "https:" ||
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))
      ? url.href
      : null;
  } catch {
    return null;
  }
}
function FilingForm({
  source,
  onClose,
  onFiled,
}: {
  source: CorrectionSource;
  onClose: () => void;
  onFiled: (item: Correction) => void;
}) {
  const [sections, setSections] = useState<CorrectionSection[]>([]);
  const [students, setStudents] = useState<CorrectionStudent[]>([]);
  const [section, setSection] = useState("");
  const [student, setStudent] = useState("");
  const [mark, setMark] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [closed, setClosed] = useState(false);
  const running = useRef(false);
  const request = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    const controller = new AbortController();
    alive.current = true;
    void source
      .sections(controller.signal)
      .then(
        (rows) => {
          if (alive.current) setSections(rows);
        },
        (failure) => {
          if (alive.current) setError(correctionMessage(failure));
        },
      )
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [source]);
  async function chooseSection(value: string) {
    const current = ++request.current;
    setSection(value);
    setStudent("");
    setStudents([]);
    setClosed(false);
    setError(null);
    if (!value) return;
    setLoading(true);
    try {
      const rows = await source.students(value);
      if (alive.current && request.current === current) setStudents(rows);
    } catch (failure) {
      if (alive.current && request.current === current) setError(correctionMessage(failure));
    } finally {
      if (alive.current && request.current === current) setLoading(false);
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (running.current || closed || loading) return;
    const proposed = correctionMark(mark);
    const errors: Record<string, string> = {};
    if (!section) errors.section = "Choose an assigned section.";
    if (!student) errors.student = "Choose a student with a final grade.";
    if (!proposed) errors.mark = "Enter 1.00–5.00 or INC.";
    if (!reason.trim()) errors.reason = "Enter the reason for this correction.";
    if (!file?.size) errors.file = "Attach the grading sheet.";
    else if (file.size > 10 * 1024 * 1024) errors.file = "The grading sheet must be at most 10 MB.";
    else if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
      errors.file = "Upload a PDF, JPEG, or PNG grading sheet.";
    setFields(errors);
    if (Object.keys(errors).length || !file || !proposed) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const item = await source.file({
        sectionId: section,
        studentId: student,
        proposedMark: proposed,
        reason: reason.trim(),
        gradingSheet: file,
      });
      if (alive.current) onFiled(item);
    } catch (failure) {
      if (!alive.current) return;
      const text = correctionMessage(failure);
      if (failure instanceof ApiError && [413, 415].includes(failure.status))
        setFields({ file: text });
      else {
        setError(text);
        if (failure instanceof ApiError && failure.code === "CORRECTION_WINDOW_CLOSED")
          setClosed(true);
      }
    } finally {
      running.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function errorFor(name: string) {
    return (
      <span
        id={"correction-" + name + "-error"}
        role={fields[name] ? "alert" : undefined}
        className="mt-1 block text-xs text-red-700"
      >
        {fields[name]}
      </span>
    );
  }
  return (
    <Dialog title="New Correction of Entry" busy={busy} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} noValidate className="mt-4 space-y-4">
        <p className="text-brand-muted text-sm">
          Correct a final grade entered in error. The recorded mark changes only after Registrar
          commitment.
        </p>
        {loading && <p role="status">Loading eligible records…</p>}
        <label className="block text-sm font-medium">
          Section
          <select
            data-first
            className={field}
            value={section}
            disabled={busy || loading}
            onChange={(e) => void chooseSection(e.target.value)}
            aria-invalid={!!fields.section}
            aria-describedby="correction-section-error"
          >
            <option value="">Choose a section</option>
            {sections.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {errorFor("section")}
        </label>
        <label className="block text-sm font-medium">
          Student
          <select
            className={field}
            value={student}
            disabled={busy || loading || !section}
            onChange={(e) => setStudent(e.target.value)}
            aria-invalid={!!fields.student}
            aria-describedby="correction-student-error"
          >
            <option value="">Choose a student</option>
            {students.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · {item.studentNumber} · {item.finalMark}
              </option>
            ))}
          </select>
          {errorFor("student")}
        </label>
        {section && !loading && !students.length && (
          <p className="text-sm">No eligible final grades were returned for this section.</p>
        )}
        <label className="block text-sm font-medium">
          New mark
          <input
            className={field}
            value={mark}
            disabled={busy}
            onChange={(e) => setMark(e.target.value)}
            aria-invalid={!!fields.mark}
            aria-describedby="correction-mark-error"
          />
          {errorFor("mark")}
        </label>
        <label className="block text-sm font-medium">
          Reason
          <textarea
            className={field + " min-h-24"}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!fields.reason}
            aria-describedby="correction-reason-error"
          />
          {errorFor("reason")}
        </label>
        <label className="block text-sm font-medium">
          Grading sheet
          <input
            type="file"
            className={field}
            accept="application/pdf,image/jpeg,image/png"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setFields((current) => ({ ...current, file: "" }));
            }}
            aria-invalid={!!fields.file}
            aria-describedby="correction-file-help correction-file-error"
          />
          {errorFor("file")}
        </label>
        <p id="correction-file-help" className="text-brand-muted text-xs">
          PDF, JPEG, or PNG; at most 10 MB. The server verifies the actual file content.
        </p>
        {error && (
          <p role="alert" className="text-brand-maroon text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={button} disabled={busy} onClick={onClose}>
            Cancel correction
          </button>
          <button className={primary} disabled={busy || loading || closed}>
            {busy ? "Filing…" : "File correction"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
