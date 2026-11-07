import { useState, type FormEvent } from "react";

import { errorMessage } from "@cbpupsis/shared/api";
import type { AddDropRequestRead } from "@cbpupsis/shared/enrollment";
import type { ScheduleCourse } from "@cbpupsis/shared/schedule";

import "@cbpupsis/account/styles.css";
import {
  calendarDateInManila,
  formatEventDates,
  formatTimeRange,
  formatTimestamp,
} from "../../lib/datetime";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import {
  closedPeriod,
  closedWindow,
  isRequestUnavailable,
  refusalMessage,
  useAddDropRequest,
  useAddDropRequests,
  useAddDropWindow,
  useAvailableCourses,
  useEnrolledCourses,
  useSendAddDrop,
  type ClosedPeriod,
} from "./useAddDrop";

/** Monday = 0 ... Sunday = 6, as the API sends meeting days. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATE_LABEL: Record<AddDropRequestRead["state"], string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATE_STYLE: Record<AddDropRequestRead["state"], string> = {
  PENDING: "bg-brand-cream text-brand-ink border-brand-border/40",
  APPROVED: "bg-white text-brand-success border-brand-success",
  REJECTED: "bg-white text-brand-maroon border-brand-maroon",
};

const TAG_LABEL = { PENDING_ADD: "Pending add", PENDING_DROP: "Pending drop" } as const;
type Tag = keyof typeof TAG_LABEL;

const card = "border-brand-border/25 rounded-2xl border bg-white p-4 shadow-sm sm:p-6";
const sectionHeading = "text-brand-ink text-xl font-bold sm:text-2xl";
const toggle =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors";
const primary =
  "bg-brand-maroon hover:bg-brand-maroon-dark inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-white disabled:opacity-60";

const units = (value: number) => value.toFixed(1);

function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span className="bg-brand-cream text-brand-ink border-brand-border/40 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold">
      {TAG_LABEL[tag]}
    </span>
  );
}

function StateBadge({ state }: { state: AddDropRequestRead["state"] }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${STATE_STYLE[state]}`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

function LoadFailure({
  what,
  error,
  onRetry,
}: {
  what: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className={`${card} space-y-3`}>
      <p className="text-brand-ink text-sm">
        We could not load {what}. {errorMessage(error)}
      </p>
      <button type="button" onClick={onRetry} className={primary}>
        Try again
      </button>
    </div>
  );
}

function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="text-brand-muted text-sm">
      Loading {what}
    </p>
  );
}

/** Replaces the form outside the add and drop period (AC-ENRL-004.7). */
function ClosedNotice({ period }: { period: ClosedPeriod }) {
  const range = formatEventDates(
    calendarDateInManila(period.start),
    calendarDateInManila(period.end),
  );
  return (
    <section role="status" aria-labelledby="add-drop-closed" className={card}>
      <h2 id="add-drop-closed" className={sectionHeading}>
        Add and drop is closed
      </h2>
      <p className="text-brand-muted mt-2 text-sm">The add and drop period is {range}.</p>
    </section>
  );
}

/** Each section's tag, from the requests still waiting for a decision. */
function pendingTags(requests: AddDropRequestRead[]): Map<string, Tag> {
  const tags = new Map<string, Tag>();
  for (const request of requests) {
    for (const course of request.courses ?? []) tags.set(course.sectionId, course.tag);
  }
  return tags;
}

function coursesAffected(request: AddDropRequestRead): string {
  return (request.courses ?? [])
    .map((course) => `${course.tag === "PENDING_ADD" ? "Add" : "Drop"} ${course.courseCode}`)
    .join(", ");
}

function RequestDetails({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const detail = useAddDropRequest(requestId);
  const request = detail.data;

  return (
    <section aria-labelledby="add-drop-details" aria-live="polite" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="add-drop-details" className="text-brand-ink text-lg font-bold">
          Add / Drop Request Details
        </h3>
        <button
          type="button"
          onClick={onClose}
          className={`${toggle} border-brand-maroon text-brand-maroon`}
        >
          Close details
        </button>
      </div>
      {detail.isPending && <Loading what="the request" />}
      {detail.isError &&
        (isRequestUnavailable(detail.error) ? (
          <p role="alert" className="text-brand-ink mt-3 text-sm">
            This request is not available.
          </p>
        ) : (
          <div className="mt-3">
            <LoadFailure
              what="the request"
              error={detail.error}
              onRetry={() => void detail.refetch()}
            />
          </div>
        ))}
      {request && (
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="font-semibold">Status</dt>
          <dd>
            <StateBadge state={request.state} />
          </dd>
          <dt className="font-semibold">Filed</dt>
          <dd>{formatTimestamp(request.createdAt)}</dd>
          <dt className="font-semibold">Units</dt>
          <dd>
            {request.unitsBefore} to {request.unitsAfter}
          </dd>
          {request.courses && request.courses.length > 0 && (
            <>
              <dt className="font-semibold">Courses</dt>
              <dd>
                <ul className="space-y-1">
                  {request.courses.map((course) => (
                    <li key={course.sectionId}>
                      {course.tag === "PENDING_ADD" ? "Add" : "Drop"} {course.courseCode}{" "}
                      {course.courseTitle} ({course.units} units)
                      {course.reason && <span className="block">Reason: {course.reason}</span>}
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
          {request.comments && (
            <>
              <dt className="font-semibold">Your comments</dt>
              <dd>{request.comments}</dd>
            </>
          )}
          {request.reviewedAt && (
            <>
              <dt className="font-semibold">Decided</dt>
              <dd>{formatTimestamp(request.reviewedAt)}</dd>
            </>
          )}
          {request.remarks && (
            <>
              <dt className="font-semibold">Reviewer remarks</dt>
              <dd>{request.remarks}</dd>
            </>
          )}
        </dl>
      )}
    </section>
  );
}

/** The student's requests and where each stands (AC-ENRL-004.3, .9). */
function RequestList() {
  const requests = useAddDropRequests();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section aria-labelledby="add-drop-requests" className="space-y-4">
      <h2 id="add-drop-requests" className={sectionHeading}>
        Add / Drop Request Status
      </h2>
      {requests.isPending && <Loading what="your requests" />}
      {requests.isError && (
        <LoadFailure
          what="your requests"
          error={requests.error}
          onRetry={() => void requests.refetch()}
        />
      )}
      {requests.isSuccess && requests.data.length === 0 && (
        <p className={`${card} text-brand-muted text-sm`}>You have no add and drop requests yet.</p>
      )}
      {/* Status and remarks change together and are read out when they do (SRS 4.3). */}
      <ul aria-live="polite" className="space-y-3">
        {requests.data?.map((request) => (
          <li key={request.requestId} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="text-brand-ink font-semibold">
                  Filed {formatTimestamp(request.createdAt)}
                </p>
                {coursesAffected(request) && <p>{coursesAffected(request)}</p>}
                <p className="text-brand-muted">
                  Units {request.unitsBefore} to {request.unitsAfter}
                </p>
                <p>
                  Status: <StateBadge state={request.state} />
                </p>
                {request.remarks && (
                  <p className="text-brand-ink">
                    <span className="font-semibold">Remarks:</span> {request.remarks}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-expanded={openId === request.requestId}
                aria-label={`View request filed ${formatTimestamp(request.createdAt)}`}
                aria-controls={openId === request.requestId ? "add-drop-detail-panel" : undefined}
                onClick={() => setOpenId(openId === request.requestId ? null : request.requestId)}
                className={`${toggle} border-brand-maroon text-brand-maroon`}
              >
                View
              </button>
            </div>
          </li>
        ))}
      </ul>
      {openId && (
        <div id="add-drop-detail-panel">
          <RequestDetails requestId={openId} onClose={() => setOpenId(null)} />
        </div>
      )}
    </section>
  );
}

function Meetings({ course }: { course: ScheduleCourse }) {
  return (
    <ul className="text-brand-muted text-xs">
      {course.meetings.map((meeting) => (
        <li key={`${meeting.dayOfWeek}-${meeting.startTime}`}>
          {WEEKDAYS[meeting.dayOfWeek]} {formatTimeRange(meeting.startTime, meeting.endTime)}
        </li>
      ))}
    </ul>
  );
}

/** US-ENRL-004: add and drop courses, and follow each request to its decision. */
export function AddDropPage() {
  const enrolled = useEnrolledCourses();
  const addDropWindow = useAddDropWindow();
  // Sections to add are asked for by the eligibility read's term id (API #221).
  const termId = addDropWindow.data?.academicTermId;
  const available = useAvailableCourses(termId);
  const requests = useAddDropRequests();
  const send = useSendAddDrop();

  const [drops, setDrops] = useState<Record<string, string>>({});
  const [adds, setAdds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const closed = closedPeriod(send.error) ?? closedWindow(addDropWindow.data);
  const deadline = addDropWindow.data?.addDropPeriod?.end;
  const courses = enrolled.data?.courses ?? [];
  // The request just sent counts at once; the list catches up when it refetches.
  const pending = [...(send.data ? [send.data] : []), ...(requests.data ?? [])].filter(
    (request) => request.state === "PENDING",
  );
  const tags = pendingTags(pending);
  const enrolledIds = new Set(courses.map((course) => course.sectionId));
  const pendingAdds = pending
    .flatMap((request) => request.courses ?? [])
    .filter(
      (course, index, all) =>
        course.tag === "PENDING_ADD" &&
        all.findIndex((other) => other.sectionId === course.sectionId) === index,
    );

  const addable = (available.data ?? []).filter(
    (course) => !enrolledIds.has(course.sectionId) && !tags.has(course.sectionId),
  );
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? addable.filter(
        (course) =>
          course.courseCode.toLowerCase().includes(needle) ||
          course.title.toLowerCase().includes(needle),
      )
    : addable;

  const before = enrolled.data?.totalCredits ?? 0;
  const dropped = courses
    .filter((course) => course.sectionId in drops)
    .reduce((sum, course) => sum + course.units, 0);
  const added = addable
    .filter((course) => adds.includes(course.sectionId))
    .reduce((sum, course) => sum + Number(course.units), 0);
  const after = before - dropped + added;
  const picked = Object.keys(drops).length + adds.length;

  function toggleDrop(sectionId: string) {
    setDrops((current) => {
      const next = { ...current };
      if (sectionId in next) delete next[sectionId];
      else next[sectionId] = "";
      return next;
    });
  }

  function toggleAdd(sectionId: string) {
    setAdds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (send.isPending) return;
    if (Object.values(drops).some((reason) => !reason.trim())) {
      setProblem("Give a reason for each course you drop.");
      return;
    }
    setProblem(null);
    send.mutate(
      {
        add: adds.map((sectionId) => ({ sectionId })),
        drop: Object.entries(drops).map(([sectionId, reason]) => ({
          sectionId,
          reason: reason.trim(),
        })),
      },
      {
        onSuccess: () => {
          setDrops({});
          setAdds([]);
        },
      },
    );
  }

  const refusal = send.isError && !closed ? refusalMessage(send.error) : null;

  return (
    <DashboardLayout>
      <div className="space-y-8 px-4 py-8 sm:px-8">
        <div>
          <h1 className="text-brand-maroon text-3xl font-bold tracking-tight sm:text-4xl">
            Add / Drop Courses
          </h1>
          <p className="text-brand-muted mt-2 max-w-3xl text-sm leading-relaxed">
            Modify your course selection during the add/drop period.
          </p>
          {(addDropWindow.data?.term || deadline) && (
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {addDropWindow.data?.term && (
                <div>
                  <dt className="text-brand-muted text-sm">Term</dt>
                  <dd className="text-brand-ink text-xl font-bold">{addDropWindow.data.term}</dd>
                </div>
              )}
              {deadline && (
                <div>
                  <dt className="text-brand-muted text-sm">Add/Drop Deadline</dt>
                  <dd className="text-brand-ink text-xl font-bold">
                    {formatEventDates(calendarDateInManila(deadline))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {enrolled.isPending && <Loading what="your enrolled courses" />}
        {enrolled.isError && (
          <LoadFailure
            what="your enrolled courses"
            error={enrolled.error}
            onRetry={() => void enrolled.refetch()}
          />
        )}

        {closed && <ClosedNotice period={closed} />}

        {enrolled.isSuccess && !closed && (
          <form onSubmit={submit} noValidate className="space-y-8">
            <section aria-labelledby="add-drop-enrolled" className="space-y-4">
              <h2 id="add-drop-enrolled" className={sectionHeading}>
                Currently Enrolled Courses
              </h2>
              {courses.length === 0 && (
                <p className={`${card} text-brand-muted text-sm`}>
                  You have no enrolled courses this term.
                </p>
              )}
              <ul className="space-y-3">
                {courses.map((course) => {
                  const tag = tags.get(course.sectionId);
                  const dropping = course.sectionId in drops;
                  const reasonId = `drop-reason-${course.sectionId}`;
                  return (
                    <li key={course.sectionId} className={card}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1 text-sm">
                          <p className="text-brand-maroon font-bold">{course.code}</p>
                          <p className="text-brand-ink">{course.title}</p>
                          <p className="text-brand-muted">{units(course.units)} units</p>
                          <Meetings course={course} />
                          {tag && <TagBadge tag={tag} />}
                        </div>
                        {!tag && (
                          <button
                            type="button"
                            aria-pressed={dropping}
                            aria-label={`Drop ${course.code}`}
                            onClick={() => toggleDrop(course.sectionId)}
                            className={`${toggle} border-brand-maroon ${dropping ? "bg-brand-maroon text-white" : "text-brand-maroon"}`}
                          >
                            Drop
                          </button>
                        )}
                      </div>
                      {dropping && (
                        <div className="mt-3">
                          <label htmlFor={reasonId} className="text-brand-ink block text-sm">
                            Reason for dropping {course.code}
                          </label>
                          <input
                            id={reasonId}
                            type="text"
                            required
                            value={drops[course.sectionId]}
                            onChange={(event) =>
                              setDrops((current) => ({
                                ...current,
                                [course.sectionId]: event.target.value,
                              }))
                            }
                            className="border-brand-input-border mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {pendingAdds.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-brand-ink text-base font-bold">Waiting for approval</h3>
                  <ul className="space-y-2">
                    {pendingAdds.map((course) => (
                      <li key={course.sectionId} className={`${card} text-sm`}>
                        <span className="text-brand-maroon font-bold">{course.courseCode}</span>{" "}
                        {course.courseTitle} <TagBadge tag="PENDING_ADD" />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section aria-labelledby="add-drop-search" className="space-y-4">
              <h2 id="add-drop-search" className={sectionHeading}>
                Add Courses
              </h2>
              <div>
                <label htmlFor="add-drop-query" className="text-brand-ink block text-sm">
                  Search courses to add
                </label>
                <input
                  id="add-drop-query"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="border-brand-input-border mt-1 min-h-11 w-full rounded-lg border px-3 text-sm"
                />
              </div>
              {available.isPending && termId !== undefined && (
                <Loading what="courses you can add" />
              )}
              {available.isError && (
                <LoadFailure
                  what="courses you can add"
                  error={available.error}
                  onRetry={() => void available.refetch()}
                />
              )}
              {available.isSuccess && matches.length === 0 && (
                <p className={`${card} text-brand-muted text-sm`}>No courses to add match.</p>
              )}
              <ul className="space-y-3">
                {matches.map((course) => {
                  const adding = adds.includes(course.sectionId);
                  return (
                    <li key={course.sectionId} className={card}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1 text-sm">
                          <p className="text-brand-maroon font-bold">{course.courseCode}</p>
                          <p className="text-brand-ink">{course.title}</p>
                          <p className="text-brand-muted">
                            {course.units} units, {course.availableSlots} of {course.capacity} slots
                            open
                          </p>
                          <ul className="text-brand-muted text-xs">
                            {course.schedule.map((meeting) => (
                              <li key={`${meeting.day}-${meeting.start}`}>
                                {WEEKDAYS[meeting.day]}{" "}
                                {formatTimeRange(
                                  meeting.start.slice(0, 5),
                                  meeting.end.slice(0, 5),
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <button
                          type="button"
                          aria-pressed={adding}
                          aria-label={`Add ${course.courseCode}`}
                          onClick={() => toggleAdd(course.sectionId)}
                          className={`${toggle} border-brand-maroon ${adding ? "bg-brand-maroon text-white" : "text-brand-maroon"}`}
                        >
                          Add
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="add-drop-units" className={card}>
              <h2 id="add-drop-units" className="text-brand-ink text-lg font-bold">
                Units
              </h2>
              <dl aria-live="polite" className="mt-2 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <dt className="text-brand-muted">Before the change</dt>
                  <dd className="text-brand-ink text-xl font-bold tabular-nums">{units(before)}</dd>
                </div>
                <div>
                  <dt className="text-brand-muted">After the change</dt>
                  <dd className="text-brand-ink text-xl font-bold tabular-nums">{units(after)}</dd>
                </div>
              </dl>
            </section>

            {(problem || refusal) && (
              <p role="alert" className="text-brand-maroon text-sm font-semibold">
                {problem ?? refusal}
              </p>
            )}
            <div role="status" className="text-brand-ink text-sm">
              {send.isSuccess && `Request sent. Status: ${STATE_LABEL[send.data.state]}.`}
            </div>

            <button type="submit" disabled={picked === 0 || send.isPending} className={primary}>
              {send.isPending ? "Sending request" : "Send request"}
            </button>
          </form>
        )}

        <RequestList />
      </div>
    </DashboardLayout>
  );
}
