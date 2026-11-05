import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  canReview,
  formatFiledDate,
  isPending,
  REVIEW_ROLES,
  reviewActionLabel,
} from "./reviewRules";
import { reviewFailure } from "./reviewErrors";
import { StatusBadge } from "./StatusBadge";
import type { Decision, EnrollmentRequest, ReviewerRole, ReviewSubmission } from "./types";

const primaryButton =
  "bg-brand-maroon hover:bg-brand-maroon-dark min-h-11 rounded-lg px-5 py-3 text-sm font-semibold text-white disabled:opacity-50";
const fieldClass =
  "border-brand-border/40 focus:border-brand-maroon min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm";

export function RequestReviewDialog({
  request,
  role,
  onClose,
  onSubmit,
  submitting = false,
  readOnlyReason,
}: {
  request: EnrollmentRequest;
  role: ReviewerRole;
  onClose: () => void;
  onSubmit: (submission: ReviewSubmission) => Promise<void>;
  submitting?: boolean;
  readOnlyReason?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submissionStarted = useRef(false);
  const [requestId, setRequestId] = useState<string | undefined>();
  const remarksField = useRef<HTMLTextAreaElement>(null);
  const referenceField = useRef<HTMLInputElement>(null);
  const decisionField = useRef<HTMLInputElement>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [remarks, setRemarks] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState<"remarks" | "reference" | "decision" | null>(
    null,
  );
  const allowed = !readOnlyReason && canReview(request, role);
  const requiresReference =
    request.kind === "waivers" && role === "registrar" && decision === "APPROVE";

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allowed || submitting || submissionStarted.current) return;
    if (!decision) {
      setError("Choose an approval or rejection before continuing.");
      setInvalidField("decision");
      decisionField.current?.focus();
      return;
    }
    if (decision === "REJECT" && !remarks.trim()) {
      setError("Give a reason for the rejection.");
      setInvalidField("remarks");
      remarksField.current?.focus();
      return;
    }
    if (requiresReference && !reference.trim()) {
      setError("Enter the VPAA approval reference.");
      setInvalidField("reference");
      referenceField.current?.focus();
      return;
    }
    submissionStarted.current = true;
    setError("");
    setRequestId(undefined);
    setInvalidField(null);
    try {
      await onSubmit({
        requestId: request.id,
        decision,
        remarks: remarks.trim(),
        vpaaReference: reference.trim(),
        version: request.version,
      });
      onClose();
    } catch (failure) {
      const result = reviewFailure(failure);
      setError(result.message);
      setRequestId(result.requestId);
      setInvalidField(result.field ?? null);
      if (result.field === "remarks") remarksField.current?.focus();
      if (result.field === "reference") referenceField.current?.focus();
    } finally {
      submissionStarted.current = false;
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="review-dialog-title"
      onCancel={(event) => {
        if (submitting || submissionStarted.current) event.preventDefault();
        else onClose();
      }}
      className="text-brand-ink backdrop:bg-brand-ink/50 fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl sm:w-full"
    >
      <div className="border-brand-border/20 sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-white px-5 py-4 sm:px-7">
        <div>
          <p className="text-brand-muted text-xs font-semibold tracking-wider uppercase">
            {request.id}
          </p>
          <h2 id="review-dialog-title" className="text-brand-maroon mt-1 text-xl font-bold">
            Request review
          </h2>
        </div>
        <button
          disabled={submitting}
          type="button"
          onClick={onClose}
          aria-label="Close request review"
          className="text-brand-muted hover:bg-brand-paper grid size-11 shrink-0 place-items-center rounded-lg text-2xl"
        >
          ×
        </button>
      </div>
      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={submitting}
        className="space-y-6 px-5 py-6 sm:px-7"
      >
        <div className="border-brand-border/20 bg-brand-paper flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4">
          <div>
            <h3 className="text-base font-bold">{request.student.name}</h3>
            <p className="text-brand-muted mt-1 text-sm">{request.student.number}</p>
            <p className="text-brand-muted mt-1 text-xs">
              {request.student.program} · {request.student.year}
            </p>
          </div>
          <StatusBadge state={request.state} />
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-brand-muted text-xs">Filed on</dt>
            <dd className="mt-1 font-medium">
              <time dateTime={request.filedAt}>{formatFiledDate(request.filedAt)}</time>
            </dd>
          </div>
          <div>
            <dt className="text-brand-muted text-xs">Request type</dt>
            <dd className="mt-1 font-medium">
              {request.kind === "add-drop"
                ? "Add and drop"
                : request.kind === "overload"
                  ? "Academic overload"
                  : "Co-requisite waiver"}
            </dd>
          </div>
        </dl>
        {request.kind === "waivers" && (
          <section aria-label="Waiver approval stages">
            <h3 className="mb-3 text-sm font-semibold">Approval progress</h3>
            <ol className="grid grid-cols-3 gap-2">
              {["Chair evaluation", "Dean recommendation", "VPAA record"].map((label, index) => {
                const current = ["PENDING_CHAIR", "PENDING_DEAN", "PENDING_VPAA"].indexOf(
                  request.state,
                );
                const completed = request.state === "APPROVED" || (current >= 0 && index < current);
                return (
                  <li
                    key={label}
                    aria-current={index === current ? "step" : undefined}
                    className={`rounded-lg border px-2 py-3 text-center text-xs leading-relaxed ${index === current ? "border-brand-maroon bg-brand-maroon/5 text-brand-maroon" : "border-brand-border/20 text-brand-muted"}`}
                  >
                    <span
                      className={`mx-auto mb-2 grid size-6 place-items-center rounded-full font-bold ${completed ? "bg-brand-success/10 text-brand-success" : "bg-brand-skeleton/20"}`}
                    >
                      {completed ? "✓" : index + 1}
                    </span>
                    {label}
                    {completed && <span className="sr-only">, completed</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        <section aria-label="Requested course changes">
          <h3 className="mb-3 text-sm font-semibold">
            {request.kind === "add-drop" ? "Course changes" : "Requested course"}
          </h3>
          <ul className="space-y-2">
            {request.courses.map((course) => (
              <li
                key={`${course.code}-${course.action}-${course.section}`}
                className="border-brand-border/25 rounded-lg border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {course.code} · {course.title}
                    </p>
                    <p className="text-brand-muted mt-1 text-xs">
                      {course.section} · {course.units} units
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-xs font-bold ${course.action === "DROP" ? "bg-brand-maroon/10 text-brand-maroon" : "bg-brand-skeleton/15 text-brand-help"}`}
                  >
                    {course.action}
                  </span>
                </div>
                {course.reason && (
                  <p className="text-brand-muted mt-2 text-xs leading-relaxed">{course.reason}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
        <div className="bg-brand-paper grid grid-cols-2 gap-4 rounded-xl p-4 text-sm">
          <p>
            <span className="text-brand-muted block text-xs">Current load</span>
            <strong className="mt-1 block text-xl">
              {request.unitsBefore} <span className="text-xs font-normal">units</span>
            </strong>
          </p>
          <p>
            <span className="text-brand-muted block text-xs">Requested load</span>
            <strong className="text-brand-maroon mt-1 block text-xl">
              {request.unitsAfter} <span className="text-xs font-normal">units</span>
            </strong>
          </p>
        </div>
        {request.condition && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-brand-muted text-xs">Waiver condition</dt>
              <dd className="mt-1 font-medium">
                {request.condition.replaceAll("_", " ").toLowerCase()}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs">Prerequisite course</dt>
              <dd className="mt-1 font-medium">{request.prerequisite}</dd>
            </div>
          </dl>
        )}
        <section>
          <h3 className="text-sm font-semibold">Student justification</h3>
          <p className="text-brand-muted mt-2 text-sm leading-relaxed">{request.justification}</p>
        </section>
        {request.history.length > 0 && (
          <section>
            <h3 className="mb-3 text-sm font-semibold">Review history</h3>
            <ol className="space-y-3">
              {request.history.map((item, index) => (
                <li
                  key={`${item.occurredAt}-${index}`}
                  className="border-brand-border/30 border-l-2 pl-3"
                >
                  <p className="text-sm font-semibold">
                    {REVIEW_ROLES[item.role]} ·{" "}
                    {item.decision === "APPROVE" ? "Approved this stage" : "Rejected"}
                  </p>
                  <p className="text-brand-muted mt-1 text-xs">
                    <time dateTime={item.occurredAt}>{formatFiledDate(item.occurredAt)}</time>
                  </p>
                  {item.remarks && <p className="mt-1 text-sm">{item.remarks}</p>}
                  {item.vpaaReference && (
                    <p className="mt-1 text-xs">VPAA reference: {item.vpaaReference}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
        {allowed ? (
          <section
            className="border-brand-border/25 space-y-4 border-t pt-5"
            aria-label="Your review decision"
          >
            <div>
              <h3 className="text-sm font-bold">Your decision</h3>
              <p className="text-brand-muted mt-1 text-xs">
                Reviewing as {REVIEW_ROLES[role]}. Changes are local to this session and reset when
                the page is refreshed.
              </p>
            </div>
            <fieldset aria-describedby={invalidField === "decision" ? "review-error" : undefined}>
              <legend className="mb-2 text-sm font-medium">
                Decision <span aria-hidden="true">*</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["APPROVE", "REJECT"] as const).map((value) => (
                  <label
                    key={value}
                    className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-sm ${decision === value ? "border-brand-maroon bg-brand-maroon/5" : "border-brand-border/30"}`}
                  >
                    <input
                      disabled={submitting}
                      ref={value === "APPROVE" ? decisionField : undefined}
                      type="radio"
                      name="review-decision"
                      value={value}
                      checked={decision === value}
                      onChange={() => {
                        setDecision(value);
                        setError("");
                        setInvalidField(null);
                      }}
                      className="accent-brand-maroon size-4"
                    />
                    {value === "APPROVE" ? reviewActionLabel(request, role) : "Reject request"}
                  </label>
                ))}
              </div>
            </fieldset>
            {requiresReference && (
              <div>
                <label htmlFor="vpaa-reference" className="mb-2 block text-sm font-medium">
                  VPAA approval reference <span aria-hidden="true">*</span>
                </label>
                <input
                  disabled={submitting}
                  ref={referenceField}
                  id="vpaa-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={200}
                  required
                  className={fieldClass}
                  aria-invalid={invalidField === "reference" || undefined}
                  aria-describedby={invalidField === "reference" ? "review-error" : "vpaa-help"}
                />
                <p id="vpaa-help" className="text-brand-muted mt-1 text-xs">
                  Enter the reference from the VPAA approval document.
                </p>
              </div>
            )}
            <div>
              <label htmlFor="review-remarks" className="mb-2 block text-sm font-medium">
                Remarks{" "}
                {decision === "REJECT" ? (
                  <span aria-hidden="true">*</span>
                ) : (
                  <span className="text-brand-muted font-normal">(optional)</span>
                )}
              </label>
              <textarea
                disabled={submitting}
                ref={remarksField}
                id="review-remarks"
                rows={3}
                maxLength={1000}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                required={decision === "REJECT"}
                className={fieldClass}
                aria-invalid={invalidField === "remarks" || undefined}
                aria-describedby={invalidField === "remarks" ? "review-error" : "remarks-help"}
              />
              <p id="remarks-help" className="text-brand-muted mt-1 text-xs">
                Give a clear reason when rejecting a request. Maximum 1,000 characters.
              </p>
            </div>
            {error && (
              <p
                id="review-error"
                role="alert"
                className="text-brand-maroon bg-brand-maroon/5 rounded-lg p-3 text-sm"
              >
                {error}
              </p>
            )}
            {requestId && <p className="text-brand-muted text-xs">Reference: {requestId}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                disabled={submitting}
                type="button"
                onClick={onClose}
                className="border-brand-border/40 min-h-11 rounded-lg border px-5 py-3 text-sm font-semibold"
              >
                Cancel
              </button>
              <button type="submit" disabled={submitting} className={primaryButton}>
                {submitting ? "Saving decision…" : "Confirm decision"}
              </button>
            </div>
          </section>
        ) : (
          <div className="border-brand-border/25 bg-brand-paper rounded-xl border p-4">
            <p className="text-sm font-semibold">
              {isPending(request.state) ? "Read-only at this stage" : "Review completed"}
            </p>
            <p className="text-brand-muted mt-1 text-sm leading-relaxed">
              {readOnlyReason
                ? readOnlyReason
                : !isPending(request.state)
                  ? "This request has already been decided. Its details are available for reference."
                  : request.kind === "overload"
                    ? "Only the College Dean can approve or reject overload requests."
                    : request.kind === "add-drop"
                      ? "The Registrar can view add and drop requests. Chairs and Deans handle decisions."
                      : "This waiver is awaiting a different review stage. Your role cannot act at this step."}
            </p>
            <button
              disabled={submitting}
              type="button"
              onClick={onClose}
              className="border-brand-border/40 mt-3 min-h-11 rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
            >
              Close details
            </button>
          </div>
        )}
      </form>
    </dialog>
  );
}
