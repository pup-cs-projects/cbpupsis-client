import { ApiError } from "@cbpupsis/shared/api";
import { gradingErrorMessage } from "@cbpupsis/shared/grades";
import { ModalDialog } from "@cbpupsis/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useMe } from "../sign-in/useAdminAuth";
import { incompleteReviewDataSource, type IncompleteReviewDataSource } from "./dataSource";

const button =
  "focus-visible:outline-offset-0! inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-brand-border/40 bg-white px-4 py-2 text-sm font-semibold hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  button + " border-brand-maroon! bg-brand-maroon! text-white hover:bg-brand-maroon-dark!";
const card = "border-brand-border/25 min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-6";
const field =
  "border-brand-input-border focus-visible:outline-offset-0! min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm";
const date = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
const labels = { PENDING_DEAN: "Pending endorsement", ENDORSED: "Endorsed", REJECTED: "Rejected" };

export function IncompleteCompletionsPage({
  dataSource = incompleteReviewDataSource,
}: {
  dataSource?: IncompleteReviewDataSource;
}) {
  const me = useMe();
  const client = useQueryClient();
  const [forbidden, setForbidden] = useState(false);
  const dean = me.data?.position === "dean" && !forbidden;
  const key = ["incomplete-completions", me.data?.id, me.data?.collegeId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => dataSource.list(signal),
    enabled: me.isSuccess && dean,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("PENDING_DEAN");
  const [selection, setSelection] = useState<{ id: string; owner: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const error = me.error ?? query.error;
  const denied = (me.isSuccess && !dean) || (error instanceof ApiError && error.status === 403);
  const items =
    query.data?.filter(
      (item) =>
        (status === "all" || item.state === status) &&
        `${item.studentName} ${item.studentNumber} ${item.courseCode}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    ) ?? [];
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <header>
          <p className="text-brand-muted text-sm">Academics / Grades</p>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold">Inc completions</h1>
          <p className="text-brand-muted mt-2 max-w-2xl text-sm leading-relaxed">
            Review completion requests for your college. Endorsement replaces the recorded Inc with
            the proposed mark.
          </p>
        </header>
        {denied ? (
          <section className={card}>
            <p role="alert">This page is not available to your role.</p>
            <Link to="/dashboard" className={button + " mt-4"}>
              Back to dashboard
            </Link>
          </section>
        ) : me.isPending ? (
          <p role="status">Checking access…</p>
        ) : error ? (
          <div role="alert" className={card}>
            <p>{gradingErrorMessage(error)}</p>
            <button
              className={button + " mt-4"}
              onClick={() => void (me.isError ? me.refetch() : query.refetch())}
            >
              Retry completions
            </button>
          </div>
        ) : (
          <>
            {notice && (
              <p role="status" className={card}>
                {notice}
              </p>
            )}
            <section className={card} aria-label="Completion requests">
              <div className="mb-5 flex flex-wrap items-end gap-4">
                <label className="min-w-0 flex-1 text-sm font-medium">
                  Search completion requests
                  <input
                    type="search"
                    className={field + " mt-2"}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className="text-sm font-medium">
                  Status
                  <select
                    className={field + " mt-2"}
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="all">All statuses</option>
                    {Object.entries(labels).map(([value, text]) => (
                      <option value={value} key={value}>
                        {text}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className={button}
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Refresh completions
                </button>
              </div>
              {query.isPending ? (
                <p role="status">Loading Inc completions…</p>
              ) : !items.length ? (
                <p className="text-brand-muted py-6 text-sm">
                  No completion requests match these filters.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <caption className="sr-only">
                      Incomplete completion requests for your college
                    </caption>
                    <thead className="bg-brand-maroon text-white">
                      <tr>
                        {[
                          "Student",
                          "Course",
                          "Proposed mark",
                          "Filed (Manila)",
                          "Status",
                          "Action",
                        ].map((text) => (
                          <th scope="col" className="px-4 py-3" key={text}>
                            {text}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-brand-border/25 border-b">
                          <th scope="row" className="px-4 py-4">
                            <p>{item.studentName}</p>
                            <p className="text-brand-muted mt-1 text-xs font-normal">
                              {item.studentNumber}
                            </p>
                          </th>
                          <td className="px-4 py-4">
                            {item.courseCode}
                            <span className="text-brand-muted mt-1 block text-xs">
                              {item.sectionName}
                            </span>
                          </td>
                          <td className="px-4 py-4 font-semibold">{item.proposedMark}</td>
                          <td className="px-4 py-4">
                            <time dateTime={item.filedAt}>{date(item.filedAt)}</time>
                          </td>
                          <td className="px-4 py-4">{labels[item.state]}</td>
                          <td className="px-4 py-4">
                            <button
                              aria-label={`Review completion for ${item.studentName}`}
                              className={button}
                              onClick={() => {
                                setNotice(null);
                                setSelection({ owner: me.data!.id, id: item.id });
                              }}
                            >
                              Review
                              <span className="sr-only"> completion for {item.studentName}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
        {!denied && selection?.owner === me.data?.id && selection && (
          <ReviewDialog
            key={`${selection.owner}:${selection.id}`}
            id={selection.id}
            owner={selection.owner}
            source={dataSource}
            onClose={() => setSelection(null)}
            onForbidden={() => {
              setSelection(null);
              setForbidden(true);
            }}
            onDecided={(decision) => {
              setSelection(null);
              setNotice(
                decision === "ENDORSE"
                  ? "Completion endorsed. The updated grade will appear in the student’s record."
                  : "Completion rejected. The recorded grade is unchanged.",
              );
              void client.invalidateQueries({ queryKey: key });
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function attachmentUrl(value: string | null): string | null {
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
function ReviewDialog({
  id,
  owner,
  source,
  onClose,
  onDecided,
  onForbidden,
}: {
  id: string;
  owner: string;
  source: IncompleteReviewDataSource;
  onClose: () => void;
  onDecided: (decision: "ENDORSE" | "REJECT") => void;
  onForbidden: () => void;
}) {
  const detail = useQuery({
    queryKey: ["incomplete-completion-detail", owner, id],
    queryFn: ({ signal }) => source.detail(id, signal),
    retry: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
  const [remarks, setRemarks] = useState("");
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const running = useRef(false);
  const remarksRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (detail.data?.state === "PENDING_DEAN") remarksRef.current?.focus();
  }, [detail.data]);
  useEffect(() => {
    if (detail.error instanceof ApiError && detail.error.status === 403) onForbidden();
  }, [detail.error, onForbidden]);
  async function decide(decision: "ENDORSE" | "REJECT") {
    const item = detail.data;
    if (!item || running.current || item.state !== "PENDING_DEAN" || conflict) return;
    if (decision === "REJECT" && !remarks.trim()) {
      setRemarkError("Enter remarks when rejecting a completion.");
      return;
    }
    running.current = true;
    setBusy(true);
    setError(null);
    setRemarkError(null);
    try {
      await source.decide(id, { version: item.version, decision, remarks: remarks.trim() });
      onDecided(decision);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 403) {
        onForbidden();
        return;
      }
      setError(gradingErrorMessage(failure));
      if (failure instanceof ApiError && failure.code === "DECISION_REMARKS_REQUIRED")
        setRemarkError("Enter remarks when rejecting a completion.");
      if (failure instanceof ApiError && failure.code === "VERSION_CONFLICT") setConflict(true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  const item = detail.data;
  const url = attachmentUrl(item?.formUrl ?? null);
  return (
    <ModalDialog open title="Review Inc completion" busy={busy} onClose={onClose}>
      {detail.isPending ? (
        <p role="status" className="mt-4">
          Loading completion details…
        </p>
      ) : detail.isError ? (
        <div role="alert" className="mt-4 text-sm">
          <p>
            {detail.error instanceof ApiError && detail.error.status === 404
              ? "This completion is not available."
              : gradingErrorMessage(detail.error)}
          </p>
          <button className={button + " mt-3"} onClick={() => void detail.refetch()}>
            Retry completion details
          </button>
        </div>
      ) : (
        item && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2">
                <dt className="text-brand-muted text-xs">Student</dt>
                <dd className="mt-1 font-semibold">
                  {item.studentName} · {item.studentNumber}
                </dd>
              </div>
              <div>
                <dt className="text-brand-muted text-xs">Course</dt>
                <dd className="mt-1">
                  {item.courseCode} · {item.sectionName}
                </dd>
              </div>
              <div>
                <dt className="text-brand-muted text-xs">Proposed change</dt>
                <dd className="mt-1 font-semibold">Inc → {item.proposedMark}</dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-brand-muted text-xs">Completion form</dt>
                <dd className="mt-1 break-words">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerPolicy="no-referrer"
                      className="text-brand-maroon underline"
                    >
                      {item.formName}
                    </a>
                  ) : (
                    item.formName
                  )}
                </dd>
              </div>
            </dl>
            {item.state === "PENDING_DEAN" ? (
              <>
                <label className="mt-5 block text-sm font-medium">
                  Review remarks
                  <textarea
                    ref={remarksRef}
                    data-initial-focus
                    className={field + " mt-2 min-h-28"}
                    value={remarks}
                    disabled={busy || conflict}
                    onChange={(event) => {
                      setRemarks(event.target.value);
                      setRemarkError(null);
                    }}
                    aria-invalid={!!remarkError}
                    aria-describedby="review-remarks-help review-remarks-error"
                    maxLength={2000}
                  />
                </label>
                <p id="review-remarks-help" className="text-brand-muted mt-1 text-xs">
                  Required when rejecting. Endorsement updates the student’s grade.
                </p>
                <p
                  id="review-remarks-error"
                  role={remarkError ? "alert" : undefined}
                  className="mt-1 text-xs text-red-700"
                >
                  {remarkError}
                </p>
              </>
            ) : (
              <p className="mt-4 text-sm">
                {labels[item.state]}
                {item.remarks ? ` · ${item.remarks}` : ""}
              </p>
            )}
            {error && (
              <p role="alert" className="text-brand-maroon mt-4 text-sm">
                {error}
              </p>
            )}
            {conflict && (
              <button
                className={button + " mt-3"}
                disabled={busy || detail.isFetching}
                onClick={async () => {
                  const result = await detail.refetch();
                  if (result.isSuccess) {
                    setConflict(false);
                    setError(null);
                  }
                }}
              >
                Reload completion
              </button>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button data-initial-focus className={button} disabled={busy} onClick={onClose}>
                Close review
              </button>
              {item.state === "PENDING_DEAN" && (
                <>
                  <button
                    className={button + " text-brand-maroon"}
                    disabled={busy || conflict}
                    onClick={() => void decide("REJECT")}
                  >
                    Reject completion
                  </button>
                  <button
                    className={primary}
                    disabled={busy || conflict}
                    onClick={() => void decide("ENDORSE")}
                  >
                    {busy ? "Saving decision…" : "Endorse completion"}
                  </button>
                </>
              )}
            </div>
          </>
        )
      )}
      {!item && (
        <div className="mt-5 flex justify-end">
          <button data-initial-focus className={button} onClick={onClose}>
            Close review
          </button>
        </div>
      )}
    </ModalDialog>
  );
}
