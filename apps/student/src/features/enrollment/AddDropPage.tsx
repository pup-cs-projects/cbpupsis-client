import { ApiError } from "@cbpupsis/shared/api";
import type { EnrollmentSection } from "@cbpupsis/shared/enrollment";
import { ErrorAlert } from "@cbpupsis/ui";
import { type Dispatch, type SetStateAction, useMemo, useState } from "react";

import "@cbpupsis/account/styles.css";
import { formatTimeRange, formatTimestamp } from "../../lib/datetime";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useCourseSchedule } from "../schedule/useCourseSchedule";
import { periodDateRange, refusalMessage, WEEKDAYS } from "./enrollmentDisplay";
import {
  useAddDropRequests,
  useAvailableCourses,
  useEligibility,
  useSubmitAddDropRequest,
} from "./useEnrollment";

function scheduleLabel(schedule: EnrollmentSection["schedule"]) {
  if (!schedule.length) return "TBA";
  return schedule
    .map(
      (meeting) =>
        `${WEEKDAYS[meeting.dayOfWeek]} ${formatTimeRange(meeting.startTime, meeting.endTime)}`,
    )
    .join(", ");
}

function statusLabel(state: "PENDING" | "APPROVED" | "REJECTED") {
  return state[0] + state.slice(1).toLowerCase();
}

function RequestStatus({ state }: { state: "PENDING" | "APPROVED" | "REJECTED" }) {
  const tone =
    state === "APPROVED"
      ? "bg-emerald-100 text-emerald-800"
      : state === "REJECTED"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {statusLabel(state)}
    </span>
  );
}

function ClosedPanel({ dates }: { dates: string }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <h2 className="text-lg font-bold text-neutral-900">Add and drop is closed</h2>
      <p className="mt-2 text-sm text-neutral-600">The active add/drop period was {dates}.</p>
    </section>
  );
}

/** US-ENRL-004: stage enrolment changes, submit once, and keep every reviewer response visible. */
export function AddDropPage() {
  const eligibility = useEligibility();
  const schedules = useCourseSchedule();
  const requests = useAddDropRequests();
  const available = useAvailableCourses(eligibility.data?.term, Boolean(eligibility.data));
  const submit = useSubmitAddDropRequest();
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("Academic concern");
  const [comments, setComments] = useState("");
  const [stagedAdds, setStagedAdds] = useState<ReadonlySet<string>>(new Set());
  const [stagedDrops, setStagedDrops] = useState<ReadonlySet<string>>(new Set());
  const [closed, setClosed] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [currentTime] = useState(() => Date.now());
  const data = eligibility.data;

  const enrolled = (() => {
    if (schedules.data?.courses?.length) {
      return schedules.data.courses.map((course) => ({
        sectionId: course.id,
        courseCode: course.courseCode,
        title: course.courseTitle,
        units: course.units,
        schedule: course.schedule.map((meeting) => ({
          dayOfWeek: WEEKDAYS.indexOf(meeting.day as (typeof WEEKDAYS)[number]),
          startTime: meeting.timeStart,
          endTime: meeting.timeEnd,
          room: course.location,
        })),
      }));
    }
    return (data?.currentEnrollment?.sections ?? []).map((section) => ({
      ...section,
      schedule: [],
    }));
  })();

  const pendingTags = useMemo(
    () =>
      new Map(
        (requests.data ?? [])
          .filter((request) => request.state === "PENDING")
          .flatMap((request) =>
            request.courses.map((course) => [course.sectionId, course.tag] as const),
          ),
      ),
    [requests.data],
  );
  const enrolledUnits = enrolled.reduce((sum, course) => sum + course.units, 0);
  const additions = (available.data ?? []).filter((course) => stagedAdds.has(course.sectionId));
  const drops = enrolled.filter((course) => stagedDrops.has(course.sectionId));
  const netDifference =
    additions.reduce((sum, course) => sum + course.units, 0) -
    drops.reduce((sum, course) => sum + course.units, 0);
  const stagedCount = additions.length + drops.length;
  const filteredCourses = (available.data ?? []).filter((course) =>
    `${course.courseCode} ${course.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  // Older eligibility responses use the enrollment period end as the add/drop deadline.
  // Reading it here makes the initial screen accurate without waiting for a refused submission.
  const addDropDeadline = data?.addDropDeadline ?? data?.academicPeriod.end;
  const dates = data
    ? periodDateRange({
        start: data.academicPeriod.start,
        end: addDropDeadline,
        isOpen: true,
      })
    : "not available";
  const isPeriodClosed = Boolean(
    closed || (addDropDeadline && new Date(addDropDeadline).getTime() < currentTime),
  );

  function toggle(setter: Dispatch<SetStateAction<ReadonlySet<string>>>, id: string) {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cancel() {
    setStagedAdds(new Set());
    setStagedDrops(new Set());
    setComments("");
    setSubmitError(null);
  }

  async function confirm() {
    if (!stagedCount) return;
    setSubmitError(null);
    try {
      await submit.mutateAsync({
        add: additions.map((course) => ({ sectionId: course.sectionId, reason })),
        drop: drops.map((course) => ({ sectionId: course.sectionId, reason })),
        comments: comments.trim() || null,
      });
      cancel();
    } catch (error) {
      if (error instanceof ApiError && error.code === "ENROLL_ADD_DROP_PERIOD_CLOSED") {
        setClosed(true);
      } else if (error instanceof ApiError && error.code === "ENROLL_BELOW_MINIMUM_LOAD") {
        setSubmitError("This drop leaves you under the N-unit minimum.");
      } else if (
        error instanceof ApiError &&
        error.status === 404 &&
        error.code === "RESOURCE_NOT_FOUND"
      ) {
        setSubmitError("This request is not available.");
      } else {
        setSubmitError(refusalMessage(error));
      }
    }
  }

  return (
    <DashboardLayout>
      <main className="space-y-6 px-4 py-8 sm:px-8">
        <nav aria-label="Breadcrumb">
          <ol className="flex gap-1.5 text-sm text-neutral-500">
            <li>Forms &amp; Requests</li>
            <li aria-hidden="true">&gt;</li>
            <li aria-current="page" className="font-semibold text-neutral-900">
              Add or Drop Courses
            </li>
          </ol>
        </nav>
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-[#7B1113]">Add / Drop Courses</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Modify your course selection during the add/drop period
          </p>
        </header>

        {(eligibility.isError || requests.isError || available.isError) && (
          <ErrorAlert
            error={eligibility.error ?? requests.error ?? available.error}
            onRetry={() => {
              void eligibility.refetch();
              void requests.refetch();
              void available.refetch();
            }}
          />
        )}
        {eligibility.isPending && (
          <p role="status" className="text-sm text-neutral-600">
            Loading add/drop information…
          </p>
        )}
        {data && (
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold text-neutral-500 uppercase">Current Date</dt>
              <dd className="mt-1 font-bold text-neutral-900">
                {new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date())}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500 uppercase">
                Add/Drop Deadline
              </dt>
              <dd className="mt-1 font-bold text-neutral-900">
                {addDropDeadline
                  ? new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(
                      new Date(addDropDeadline),
                    )
                  : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500 uppercase">Remaining Period</dt>
              <dd className="mt-1 font-bold text-neutral-900">
                {addDropDeadline
                  ? `${Math.max(0, Math.ceil((new Date(addDropDeadline).getTime() - currentTime) / 86_400_000))} days`
                  : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-neutral-500 uppercase">Current Status</dt>
              <dd className="mt-1 font-bold text-neutral-900">Fully Enrolled</dd>
            </div>
          </dl>
        )}

        {data && isPeriodClosed ? (
          <ClosedPanel dates={dates} />
        ) : (
          data && (
            <>
              <section
                aria-labelledby="enrolled-courses-title"
                className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm"
              >
                <h2
                  id="enrolled-courses-title"
                  className="px-5 pt-5 text-xl font-bold text-neutral-900"
                >
                  Currently Enrolled Courses
                </h2>
                <table className="mt-4 w-full min-w-[44rem] text-sm">
                  <thead className="bg-[#7B1113] text-white">
                    <tr>
                      <th className="px-4 py-3 text-left">Course Code</th>
                      <th className="px-4 py-3 text-left">Course Title</th>
                      <th className="px-4 py-3 text-right">Units</th>
                      <th className="px-4 py-3 text-left">Schedule</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolled.map((course) => {
                      const pending = pendingTags.get(course.sectionId);
                      return (
                        <tr key={course.sectionId} className="border-t border-neutral-100">
                          <td className="px-4 py-3 font-semibold">{course.courseCode}</td>
                          <td className="px-4 py-3">{course.title}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {course.units.toFixed(1)}
                          </td>
                          <td className="px-4 py-3">{scheduleLabel(course.schedule)}</td>
                          <td className="px-4 py-3 text-right">
                            {pending === "PENDING_DROP" ? (
                              <span className="text-sm font-medium text-amber-700">
                                Pending drop
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggle(setStagedDrops, course.sectionId)}
                                aria-pressed={stagedDrops.has(course.sectionId)}
                                className="rounded-full border border-[#7B1113] px-3 py-1 text-xs font-semibold text-[#7B1113] hover:bg-red-50"
                              >
                                {stagedDrops.has(course.sectionId) ? "Undo drop" : "Drop"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section
                aria-labelledby="available-courses-title"
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="available-courses-title" className="text-xl font-bold text-neutral-900">
                    Available Courses
                  </h2>
                  <label className="sr-only" htmlFor="course-search">
                    Search courses
                  </label>
                  <input
                    id="course-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search courses"
                    className="h-10 w-full rounded-lg border border-neutral-300 px-3 text-sm sm:w-72"
                  />
                </div>
                <ul className="mt-4 divide-y divide-neutral-100">
                  {filteredCourses.map((course) => {
                    const pending = pendingTags.get(course.sectionId);
                    return (
                      <li
                        key={course.sectionId}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <p className="font-semibold text-neutral-900">
                            {course.courseCode} <span className="font-normal">{course.title}</span>
                          </p>
                          <p className="text-xs text-neutral-500">
                            {course.units.toFixed(1)} units · {scheduleLabel(course.schedule)}
                          </p>
                        </div>
                        {pending === "PENDING_ADD" ? (
                          <span className="font-medium text-amber-700">Pending add</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggle(setStagedAdds, course.sectionId)}
                            aria-pressed={stagedAdds.has(course.sectionId)}
                            disabled={!course.prerequisitesSatisfied || course.availableSlots === 0}
                            className="rounded-full border border-[#7B1113] px-3 py-1 text-xs font-semibold text-[#7B1113] hover:bg-red-50 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
                          >
                            {stagedAdds.has(course.sectionId) ? "Remove" : "Add"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                  {!filteredCourses.length && (
                    <li className="py-6 text-center text-sm text-neutral-500">
                      No available courses match your search.
                    </li>
                  )}
                </ul>
              </section>

              <section aria-labelledby="submit-request-title">
                <h2 id="submit-request-title" className="text-xl font-bold text-neutral-900">
                  Submit Request
                </h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <label
                      className="block text-sm font-semibold text-neutral-800"
                      htmlFor="reason"
                    >
                      Reason
                      <select
                        id="reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        className="mt-1 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm"
                      >
                        <option>Academic concern</option>
                        <option>Schedule conflict</option>
                        <option>Personal circumstance</option>
                        <option>Other</option>
                      </select>
                    </label>
                    <label
                      className="block text-sm font-semibold text-neutral-800"
                      htmlFor="comments"
                    >
                      Provide a detailed description to reason out this action
                      <textarea
                        id="comments"
                        value={comments}
                        onChange={(event) => setComments(event.target.value)}
                        className="mt-1 min-h-32 w-full rounded-lg border border-neutral-300 p-3 text-sm"
                      />
                    </label>
                  </div>
                  <aside
                    aria-label="Staged request items"
                    className="rounded-xl border border-neutral-300 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-neutral-900">Staged items</h3>
                      <span className="text-sm text-neutral-600">{stagedCount} total</span>
                    </div>
                    <ul className="mt-3 space-y-2 text-sm">
                      {[
                        ...drops.map((course) => ({ ...course, action: "Drop" })),
                        ...additions.map((course) => ({ ...course, action: "Add" })),
                      ].map((item) => (
                        <li key={item.sectionId} className="flex justify-between gap-3">
                          <span>
                            <b>{item.courseCode}</b> {item.title}
                          </span>
                          <span className="font-semibold text-[#7B1113]">{item.action}</span>
                        </li>
                      ))}
                      {!stagedCount && <li className="text-neutral-500">No courses staged.</li>}
                    </ul>
                  </aside>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-neutral-100 p-4 text-center text-sm">
                  <div>
                    <dt className="text-neutral-500">Units before</dt>
                    <dd className="font-bold">{enrolledUnits.toFixed(1)}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Net difference</dt>
                    <dd className="font-bold">
                      {netDifference >= 0 ? "+" : ""}
                      {netDifference.toFixed(1)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Units after</dt>
                    <dd className="font-bold">{(enrolledUnits + netDifference).toFixed(1)}</dd>
                  </div>
                </dl>
                {submitError && (
                  <p role="alert" className="mt-3 text-sm font-medium text-red-700">
                    {submitError}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void confirm()}
                    disabled={!stagedCount || submit.isPending}
                    className="h-11 min-w-[160px] rounded-lg bg-[#7B1113] px-6 text-sm font-semibold text-white hover:bg-[#630e10] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submit.isPending ? "Submitting…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={cancel}
                    className="h-11 min-w-[160px] rounded-lg border border-neutral-300 px-6 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                </div>
              </section>

              <section
                aria-labelledby="requests-title"
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <h2 id="requests-title" className="text-xl font-bold text-neutral-900">
                  Request Status
                </h2>
                <ul className="mt-4 space-y-3">
                  {(requests.data ?? []).map((request) => (
                    <li
                      key={request.requestId}
                      className="rounded-lg border border-neutral-200 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-semibold text-neutral-900">
                          Request filed {formatTimestamp(request.createdAt)}
                        </p>
                        <RequestStatus state={request.state} />
                      </div>
                      <p className="mt-2 text-sm text-neutral-700">
                        {request.courses
                          .map(
                            (course) =>
                              `${course.tag === "PENDING_ADD" ? "Add" : "Drop"} ${course.courseCode}`,
                          )
                          .join(", ")}
                      </p>
                      <p className="mt-2 text-sm text-neutral-700">
                        <span className="font-semibold">Reviewer remarks:</span>{" "}
                        {request.remarks || "No reviewer remarks yet."}
                      </p>
                    </li>
                  ))}
                  {!requests.data?.length && (
                    <li className="text-sm text-neutral-500">
                      You have not submitted an add/drop request.
                    </li>
                  )}
                </ul>
              </section>
            </>
          )
        )}
      </main>
    </DashboardLayout>
  );
}
