import { useState, type FormEvent, type ReactNode } from "react";

import { errorMessage } from "@cbpupsis/shared/api";
import type { AddDropRequestRead } from "@cbpupsis/shared/enrollment";
import { ModalDialog } from "@cbpupsis/ui";

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
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

const TAG_LABEL = { PENDING_ADD: "Pending add", PENDING_DROP: "Pending drop" } as const;
type Tag = keyof typeof TAG_LABEL;

const card = "border-brand-border/25 rounded-2xl border bg-white p-4 shadow-sm sm:p-6";
const sectionHeading = "text-xl font-bold text-neutral-900 mb-3";
const toggle =
  "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors";
const primary =
  "bg-brand-maroon hover:bg-brand-maroon-dark inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-white disabled:opacity-60";

const pillOutline =
  "inline-flex items-center justify-center rounded-full border border-[#7B1113] px-5 py-1.5 text-xs font-semibold text-[#7B1113] transition-colors hover:bg-[#7B1113]/5";
const pillSolid =
  "inline-flex items-center justify-center rounded-full bg-[#7B1113] px-5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#630e10]";
const pillStaged =
  "inline-flex items-center justify-center rounded-full border border-neutral-300 bg-neutral-100 px-5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors";
const searchInput =
  "mb-4 w-full max-w-sm rounded-lg border border-neutral-300 px-3.5 py-2 text-sm focus:border-[#7B1113] focus:ring-2 focus:ring-[#7B1113]/20 focus:outline-none";
const activeTabStyle = "border-b-2 border-[#7B1113] pb-2.5 font-semibold text-[#7B1113]";
const inactiveTabStyle = "pb-2.5 text-neutral-500 transition-colors hover:text-neutral-800";
const actionButtonBase =
  "inline-flex h-11 min-w-[160px] items-center justify-center rounded-lg px-6 text-sm font-semibold transition-colors";
const primaryAction = `${actionButtonBase} bg-[#7B1113] text-white shadow-sm hover:bg-[#630e10] disabled:opacity-60`;
const secondaryAction = `${actionButtonBase} border border-neutral-300 text-neutral-700 hover:bg-neutral-50 disabled:opacity-60`;

const units = (value: number) => value.toFixed(1);

const REASON_OPTIONS = ["Schedule Conflict", "Academic Load Adjustment", "Medical", "Personal"];

const caption = "Add and drop requests";

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
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${STATE_STYLE[state]}`}
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
      <p className="text-brand-muted mt-2 text-sm">The active add/drop period was {range}.</p>
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

function requestCourseCodes(request: AddDropRequestRead): string {
  return (request.courses ?? []).map((course) => course.courseCode).join(", ");
}

function requestType(request: AddDropRequestRead): string {
  const requestTags = new Set((request.courses ?? []).map((course) => course.tag));
  if (requestTags.has("PENDING_ADD") && requestTags.has("PENDING_DROP")) return "Add / Drop";
  if (requestTags.has("PENDING_ADD")) return "Add";
  if (requestTags.has("PENDING_DROP")) return "Drop";
  return "—";
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
    <section
      aria-labelledby="add-drop-requests"
      className="mt-10 space-y-3 border-t border-neutral-200 pt-8"
    >
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
      {requests.isSuccess &&
        (requests.data.length === 0 ? (
          <p
            data-testid="empty-requests"
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-5 text-center text-sm text-neutral-500"
          >
            You have no add and drop requests yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
            {/* A keyboard user can focus the region to scroll it when the table is wider than it. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1) */}
            <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <caption className="sr-only">{caption}</caption>
                <thead className="bg-[#7B1113] text-white">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                    >
                      Date Submitted
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                    >
                      Courses
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                    >
                      Remarks
                    </th>
                  </tr>
                </thead>
                {/* Status and remarks change together and are read out when they do (SRS 4.3). */}
                <tbody aria-live="polite">
                  {requests.data.map((request) => (
                    <tr
                      key={request.requestId}
                      className="border-b border-neutral-100 transition-colors hover:bg-neutral-50/50"
                    >
                      <td className="px-6 py-4 align-top text-sm whitespace-nowrap">
                        <button
                          type="button"
                          aria-expanded={openId === request.requestId}
                          aria-label={`View request filed ${formatTimestamp(request.createdAt)}`}
                          aria-controls={
                            openId === request.requestId ? "add-drop-detail-panel" : undefined
                          }
                          onClick={() =>
                            setOpenId(openId === request.requestId ? null : request.requestId)
                          }
                          className="font-semibold text-neutral-900 underline-offset-2 hover:underline"
                        >
                          {formatTimestamp(request.createdAt)}
                        </button>
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-neutral-700">
                        {requestCourseCodes(request) || "—"}
                      </td>
                      <td className="px-6 py-4 align-top text-sm whitespace-nowrap text-neutral-700">
                        {requestType(request)}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <StateBadge state={request.state} />
                      </td>
                      <td className="px-6 py-4 align-top text-sm text-neutral-700">
                        {request.remarks || <span className="text-neutral-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      {openId && (
        <div id="add-drop-detail-panel">
          <RequestDetails requestId={openId} onClose={() => setOpenId(null)} />
        </div>
      )}
    </section>
  );
}

/** A course row, once each data source's shape is normalized for the shared table. */
interface CourseRow {
  sectionId: string;
  code: string;
  title: string;
  units: number;
  schedule: Array<{ day: number; start: string; end: string }>;
}

function ScheduleCell({ schedule }: { schedule: CourseRow["schedule"] }) {
  return (
    <ul className="space-y-1">
      {schedule.map((meeting) => (
        <li key={`${meeting.day}-${meeting.start}`} className="text-sm whitespace-nowrap">
          <span className="font-semibold text-neutral-800">{WEEKDAYS[meeting.day]}</span>
          {"  "}
          <span className="text-neutral-600 tabular-nums">
            {formatTimeRange(meeting.start, meeting.end)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The My Schedule table design, shared by the enrolled and available-to-add tabs. */
function CourseActionTable({
  caption,
  rows,
  emptyMessage,
  renderAction,
}: {
  caption: string;
  rows: CourseRow[];
  emptyMessage: string;
  renderAction: (row: CourseRow) => ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-neutral-500">{emptyMessage}</p>
      ) : (
        // A keyboard user can focus the region to scroll it when the table is wider than it.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1)
        <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <caption className="sr-only">{caption}</caption>
            <thead className="bg-[#7B1113] text-white">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                >
                  Course Code &amp; Title
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-center text-xs font-semibold tracking-wider uppercase"
                >
                  Units
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase"
                >
                  Schedule
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-right text-xs font-semibold tracking-wider uppercase"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.sectionId}
                  className="border-b border-neutral-100 transition-colors hover:bg-neutral-50/50"
                >
                  <th scope="row" className="px-6 py-4 text-left align-top font-normal">
                    <span className="block text-sm font-bold text-[#7B1113]">{row.code}</span>
                    <span className="block text-sm text-neutral-700">{row.title}</span>
                  </th>
                  <td className="px-6 py-4 text-center align-top text-sm text-neutral-800 tabular-nums">
                    {units(row.units)}
                  </td>
                  <td className="px-6 py-4 align-top">
                    <ScheduleCell schedule={row.schedule} />
                  </td>
                  <td className="px-6 py-4 text-right align-top">{renderAction(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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

  const [tab, setTab] = useState<"enrolled" | "available">("enrolled");
  const [drops, setDrops] = useState<string[]>([]);
  const [adds, setAdds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [query, setQuery] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [currentTime] = useState(() => new Date().toISOString());

  const closed = closedPeriod(send.error) ?? closedWindow(addDropWindow.data);
  const deadline = addDropWindow.data?.addDropPeriod?.end;
  const daysRemaining = deadline
    ? Math.max(
        0,
        Math.ceil((new Date(deadline).getTime() - new Date(currentTime).getTime()) / 86_400_000),
      )
    : null;
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

  const enrolledRows: CourseRow[] = courses.map((course) => ({
    sectionId: course.sectionId,
    code: course.code,
    title: course.title,
    units: course.units,
    schedule: course.meetings.map((meeting) => ({
      day: meeting.dayOfWeek,
      start: meeting.startTime,
      end: meeting.endTime,
    })),
  }));
  const availableRows: CourseRow[] = matches.map((course) => ({
    sectionId: course.sectionId,
    code: course.courseCode,
    title: course.title,
    units: Number(course.units),
    schedule: course.schedule.map((meeting) => ({
      day: meeting.day,
      start: meeting.start.slice(0, 5),
      end: meeting.end.slice(0, 5),
    })),
  }));

  const before = enrolled.data?.totalCredits ?? 0;
  const dropped = courses
    .filter((course) => drops.includes(course.sectionId))
    .reduce((sum, course) => sum + course.units, 0);
  const added = addable
    .filter((course) => adds.includes(course.sectionId))
    .reduce((sum, course) => sum + Number(course.units), 0);
  const after = before - dropped + added;
  const picked = drops.length + adds.length;

  const stagedItems = [
    ...courses
      .filter((course) => drops.includes(course.sectionId))
      .map((course) => ({
        sectionId: course.sectionId,
        code: course.code,
        title: course.title,
        action: "Drop" as const,
      })),
    ...addable
      .filter((course) => adds.includes(course.sectionId))
      .map((course) => ({
        sectionId: course.sectionId,
        code: course.courseCode,
        title: course.title,
        action: "Add" as const,
      })),
  ];

  function toggleDrop(sectionId: string) {
    setDrops((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  }

  function toggleAdd(sectionId: string) {
    setAdds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  }

  function cancelSelections() {
    setDrops([]);
    setAdds([]);
    setReason("");
    setDescription("");
    setProblem(null);
  }

  // Checks the form, then asks the student to confirm before anything is sent.
  function submit(event: FormEvent) {
    event.preventDefault();
    if (send.isPending) return;
    if (!reason.trim()) {
      setProblem("Select a reason for this request.");
      document.getElementById("add-drop-reason")?.focus();
      return;
    }
    if (!description.trim()) {
      setProblem("Describe why you are making this request.");
      document.getElementById("add-drop-description")?.focus();
      return;
    }
    setProblem(null);
    setConfirming(true);
  }

  function sendRequest() {
    if (send.isPending) return;
    send.mutate(
      {
        add: adds.map((sectionId) => ({ sectionId })),
        drop: drops.map((sectionId) => ({ sectionId, reason: reason.trim() })),
        comments: description.trim() || null,
      },
      {
        onSuccess: () => {
          setDrops([]);
          setAdds([]);
          setReason("");
          setDescription("");
        },
        onSettled: () => setConfirming(false),
      },
    );
  }

  const refusal = send.isError && !closed ? refusalMessage(send.error) : null;

  return (
    <DashboardLayout>
      <div className="space-y-8 px-4 py-8 sm:px-8">
        <nav aria-label="Breadcrumb">
          <ol className="text-brand-muted flex flex-wrap items-center gap-1.5 text-sm">
            <li>Forms &amp; Requests</li>
            <li aria-hidden="true">&gt;</li>
            <li aria-current="page" className="text-brand-ink font-semibold">
              Add or Drop Courses
            </li>
          </ol>
        </nav>
        <div>
          <h1 className="text-brand-maroon text-3xl font-bold tracking-tight sm:text-4xl">
            Add / Drop Courses
          </h1>
          <p className="text-brand-muted mt-2 max-w-3xl text-sm leading-relaxed">
            Modify your course selection during the add/drop period.
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:grid-cols-4">
            <div>
              <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
                Current Date
              </dt>
              <dd className="text-brand-ink mt-1 font-bold">
                {formatEventDates(calendarDateInManila(currentTime))}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
                Add/Drop Deadline
              </dt>
              <dd className="text-brand-ink mt-1 font-bold">
                {deadline ? formatEventDates(calendarDateInManila(deadline)) : "TBA"}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
                Remaining Period
              </dt>
              <dd className="text-brand-ink mt-1 font-bold">
                {daysRemaining === null ? "TBA" : `${daysRemaining} days`}
              </dd>
            </div>
            <div>
              <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
                Current Status
              </dt>
              <dd className="text-brand-ink mt-1 font-bold">Fully Enrolled</dd>
            </div>
          </dl>
        </div>

        {enrolled.isPending && <Loading what="your enrolled courses" />}
        {enrolled.isError && (
          <LoadFailure
            what="your enrolled courses"
            error={enrolled.error}
            onRetry={() => void enrolled.refetch()}
          />
        )}
        {addDropWindow.isPending && <Loading what="the add/drop period" />}
        {addDropWindow.isError && (
          <LoadFailure
            what="the add/drop period"
            error={addDropWindow.error}
            onRetry={() => void addDropWindow.refetch()}
          />
        )}

        {closed && <ClosedNotice period={closed} />}

        {enrolled.isSuccess && addDropWindow.isSuccess && !closed && (
          <form onSubmit={submit} noValidate className="space-y-8">
            <section aria-label="Course browser" className="space-y-4">
              <div
                role="tablist"
                aria-label="Course browser"
                className="flex gap-6 border-b border-neutral-200"
              >
                <button
                  type="button"
                  role="tab"
                  id="add-drop-tab-enrolled"
                  aria-selected={tab === "enrolled"}
                  aria-controls="add-drop-panel-enrolled"
                  onClick={() => setTab("enrolled")}
                  className={tab === "enrolled" ? activeTabStyle : inactiveTabStyle}
                >
                  Currently Enrolled ({courses.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  id="add-drop-tab-available"
                  aria-selected={tab === "available"}
                  aria-controls="add-drop-panel-available"
                  onClick={() => setTab("available")}
                  className={tab === "available" ? activeTabStyle : inactiveTabStyle}
                >
                  Available Courses to Add
                </button>
              </div>

              {tab === "enrolled" && (
                <div
                  id="add-drop-panel-enrolled"
                  role="tabpanel"
                  aria-labelledby="add-drop-tab-enrolled"
                  className="space-y-4"
                >
                  <CourseActionTable
                    caption="Currently enrolled courses"
                    rows={enrolledRows}
                    emptyMessage="You have no enrolled courses this term."
                    renderAction={(row) => {
                      const tag = tags.get(row.sectionId);
                      if (tag) return <TagBadge tag={tag} />;
                      const dropping = drops.includes(row.sectionId);
                      return (
                        <button
                          type="button"
                          aria-pressed={dropping}
                          aria-label={dropping ? `Undo dropping ${row.code}` : `Drop ${row.code}`}
                          onClick={() => toggleDrop(row.sectionId)}
                          className={dropping ? pillStaged : pillOutline}
                        >
                          {dropping ? "Undo" : "Drop"}
                        </button>
                      );
                    }}
                  />
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
                </div>
              )}

              {tab === "available" && (
                <div
                  id="add-drop-panel-available"
                  role="tabpanel"
                  aria-labelledby="add-drop-tab-available"
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="add-drop-query" className="sr-only">
                      Search courses to add
                    </label>
                    <input
                      id="add-drop-query"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search courses by code, title, or schedule..."
                      className={searchInput}
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
                  {available.isSuccess && (
                    <CourseActionTable
                      caption="Available courses to add"
                      rows={availableRows}
                      emptyMessage="No courses to add match."
                      renderAction={(row) => {
                        const adding = adds.includes(row.sectionId);
                        return (
                          <button
                            type="button"
                            aria-pressed={adding}
                            aria-label={adding ? `Remove ${row.code}` : `Add ${row.code}`}
                            onClick={() => toggleAdd(row.sectionId)}
                            className={adding ? pillStaged : pillSolid}
                          >
                            {adding ? "Remove" : "Add"}
                          </button>
                        );
                      }}
                    />
                  )}
                </div>
              )}
            </section>

            <section
              aria-labelledby="add-drop-units"
              className="rounded-xl border border-neutral-200 bg-white p-5"
            >
              <h2 id="add-drop-units" className="text-lg font-bold text-neutral-900">
                Units
              </h2>
              <dl aria-live="polite" className="mt-3 flex flex-wrap gap-x-10 gap-y-2 text-sm">
                <div>
                  <dt className="text-neutral-500">Before the change</dt>
                  <dd className="text-xl font-bold text-neutral-900 tabular-nums">
                    {units(before)}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">After the change</dt>
                  <dd className="text-xl font-bold text-neutral-900 tabular-nums">
                    {units(after)}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="add-drop-submit">
              <h2 id="add-drop-submit" className="mt-6 mb-4 text-xl font-bold text-neutral-900">
                Submit Request
              </h2>
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <div>
                    <label
                      htmlFor="add-drop-reason"
                      className="mb-1.5 block text-sm font-semibold text-neutral-800"
                    >
                      Reason{" "}
                      <span aria-hidden="true" className="text-red-600">
                        *
                      </span>
                    </label>
                    <select
                      id="add-drop-reason"
                      required
                      aria-required="true"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm focus:border-[#7B1113] focus:ring-2 focus:ring-[#7B1113]/20 focus:outline-none"
                    >
                      <option value="" disabled>
                        Reason
                      </option>
                      {REASON_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="add-drop-description"
                      className="mb-1.5 block text-sm font-semibold text-neutral-800"
                    >
                      Description{" "}
                      <span aria-hidden="true" className="text-red-600">
                        *
                      </span>
                    </label>
                    <textarea
                      id="add-drop-description"
                      required
                      aria-required="true"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Provide a detailed description to reason out this action"
                      className="min-h-[180px] w-full resize-none rounded-xl border border-neutral-300 bg-white p-4 text-sm focus:border-[#7B1113] focus:ring-2 focus:ring-[#7B1113]/20 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex h-[260px] flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                  <div className="grid grid-cols-3 border-b border-neutral-100 pb-3 text-sm font-bold text-[#7B1113]">
                    <span>Code</span>
                    <span>Course Name</span>
                    <span className="text-right">Action</span>
                  </div>
                  <div className="my-2 max-h-[150px] flex-1 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300">
                    {stagedItems.length === 0 ? (
                      <p className="flex h-full items-center justify-center text-center text-sm text-neutral-400">
                        No courses selected for add or drop yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-neutral-100">
                        {stagedItems.map((item) => (
                          <li
                            key={`${item.action}-${item.sectionId}`}
                            className="grid grid-cols-3 items-center py-2.5 text-sm"
                          >
                            <span className="font-bold text-neutral-900">{item.code}</span>
                            <span className="text-neutral-700">{item.title}</span>
                            <span className="text-right text-neutral-700">{item.action}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="border-t border-neutral-200" />
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-sm font-semibold text-neutral-800">Total Request</span>
                      <span className="text-xl font-bold text-neutral-900">{picked}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {(problem || refusal) && (
              <p role="alert" className="text-sm font-semibold text-[#7B1113]">
                {problem ?? refusal}
              </p>
            )}
            <div role="status" className="text-brand-ink text-sm">
              {send.isSuccess && `Request sent. Status: ${STATE_LABEL[send.data.state]}.`}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancelSelections}
                disabled={picked === 0 || send.isPending}
                className={secondaryAction}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={picked === 0 || send.isPending}
                className={primaryAction}
              >
                {send.isPending ? "Sending request" : "Send request"}
              </button>
            </div>
          </form>
        )}

        <ModalDialog
          open={confirming}
          title="Send this request?"
          busy={send.isPending}
          onClose={() => setConfirming(false)}
        >
          <p className="mt-4 text-sm leading-relaxed">
            Are you sure you want to send this add or drop request for {picked}{" "}
            {picked === 1 ? "course" : "courses"}? The approver will review it with the reason and
            description you gave.
          </p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              data-initial-focus
              onClick={() => setConfirming(false)}
              disabled={send.isPending}
              className={secondaryAction}
            >
              Go back
            </button>
            <button
              type="button"
              onClick={sendRequest}
              disabled={send.isPending}
              className={primaryAction}
            >
              {send.isPending ? "Sending request" : "Yes, send request"}
            </button>
          </div>
        </ModalDialog>

        <RequestList />
      </div>
    </DashboardLayout>
  );
}
