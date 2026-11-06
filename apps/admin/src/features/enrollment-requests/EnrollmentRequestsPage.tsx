import { DashboardIcon, DashboardLoading, ErrorAlert } from "@cbpupsis/ui";
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type KeyboardEvent } from "react";

import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useMe } from "../sign-in/useAdminAuth";
import { RequestReviewDialog } from "./RequestReviewDialog";
import { RequestsTable } from "./RequestsTable";
import { canReview, isPending, isReviewerRole, manilaDate, REQUEST_TABS } from "./reviewRules";
import { enrollmentReviewDataSource } from "./dataSource";
import { createMockReviewDataSource } from "./mockDataSource";
import type { EnrollmentReviewDataSource, RequestKind } from "./types";
import { useEnrollmentRequests } from "./useEnrollmentRequests";

const filterField =
  "border-brand-border/35 focus:border-brand-maroon focus-visible:outline-offset-0! min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm";

export function EnrollmentRequestsPage({
  dataSource = enrollmentReviewDataSource,
}: { dataSource?: EnrollmentReviewDataSource } = {}) {
  const me = useMe();
  const [tab, setTab] = useState<RequestKind>("add-drop");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const actualRole = isReviewerRole(me.data?.position) ? me.data.position : null;
  const role = actualRole;
  const ownerId = me.data?.id;
  const source = useMemo(
    () =>
      dataSource ??
      (import.meta.env.DEV && actualRole && ownerId
        ? createMockReviewDataSource(ownerId, actualRole)
        : undefined),
    [dataSource, actualRole, ownerId],
  );
  const review = useEnrollmentRequests(tab, me.data?.id, Boolean(actualRole), source);
  const tabInfo = REQUEST_TABS.find((item) => item.kind === tab)!;
  const requests = review.data?.items ?? [];
  const dateInvalid = Boolean(fromDate && toDate && fromDate > toDate);
  const search = query.trim().toLowerCase();
  const filtered = requests
    .filter((item) => {
      const matchesSearch =
        `${item.id} ${item.student.id} ${item.student.name ?? ""} ${item.student.number ?? ""} ${item.student.program ?? ""} ${item.sectionId ?? ""} ${item.prerequisite ?? ""} ${item.courses.map((course) => `${course.code} ${course.title}`).join(" ")}`
          .toLowerCase()
          .includes(search);
      const date = manilaDate(item.filedAt);
      return (
        matchesSearch &&
        (status === "all" ||
          (status === "pending" ? isPending(item.state) : item.state === status)) &&
        (!fromDate || date >= fromDate) &&
        (!toDate || date <= toDate) &&
        !dateInvalid
      );
    })
    .sort((a, b) =>
      sort === "newest" ? b.filedAt.localeCompare(a.filedAt) : a.filedAt.localeCompare(b.filedAt),
    );
  const hasFilters = Boolean(query || status !== "all" || fromDate || toDate);
  const total = hasFilters ? filtered.length : (review.data?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRequests = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = requests.find((item) => item.id === selectedId);
  const actionable = requests.filter(
    (item) => role && !review.rowNotices[item.id] && canReview(item, role),
  ).length;
  const pending = requests.filter((item) => isPending(item.state)).length;

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  }
  function changeTab(kind: RequestKind) {
    setTab(kind);
    setSelectedId(null);
    clearFilters();
  }
  function tabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % REQUEST_TABS.length;
    else if (event.key === "ArrowLeft")
      next = (index + REQUEST_TABS.length - 1) % REQUEST_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = REQUEST_TABS.length - 1;
    else return;
    event.preventDefault();
    changeTab(REQUEST_TABS[next].kind);
    document.getElementById(`request-tab-${REQUEST_TABS[next].kind}`)?.focus();
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <nav
          aria-label="Breadcrumb"
          className="text-brand-muted flex min-h-11 flex-wrap items-center gap-2 text-xs"
        >
          <Link
            to="/dashboard"
            className="hover:text-brand-maroon inline-flex min-h-11 items-center rounded-sm"
          >
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span>Academics</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-brand-ink font-semibold">
            Enrollment requests
          </span>
        </nav>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-brand-muted mb-2 text-xs font-semibold tracking-[0.16em] uppercase">
              Academic administration
            </p>
            <h1 className="text-brand-maroon text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              Enrollment requests
            </h1>
            <p className="text-brand-muted mt-3 max-w-2xl text-sm leading-relaxed">
              Review course changes, academic overloads, and co-requisite waivers in one place.
            </p>
          </div>
        </header>
        {me.isPending && (
          <div
            role="status"
            className="border-brand-border/25 text-brand-muted rounded-xl border bg-white p-8 text-sm"
          >
            Loading your review access…
          </div>
        )}
        {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
        {me.isSuccess && !actualRole && (
          <section
            aria-labelledby="review-unavailable-heading"
            className="border-brand-border/25 rounded-xl border bg-white p-8"
          >
            <h2 id="review-unavailable-heading" className="text-brand-maroon text-xl font-bold">
              Not available to your role
            </h2>
            <p className="text-brand-muted mt-3 max-w-xl text-sm leading-relaxed">
              Enrollment reviews are available to Department Chairs, College Deans, and the
              Registrar.
            </p>
            <Link
              to="/dashboard"
              className="text-brand-maroon mt-4 inline-flex min-h-11 items-center font-semibold"
            >
              Return to dashboard →
            </Link>
          </section>
        )}
        {me.isSuccess && actualRole && (
          <>
            {review.notice && (
              <div
                role="status"
                className="border-brand-border/25 text-brand-help flex items-center justify-between gap-3 rounded-xl border px-5 py-3 text-sm"
              >
                <p>{review.notice}</p>
                <button
                  type="button"
                  aria-label="Dismiss decision message"
                  onClick={review.dismissNotice}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-xl focus-visible:outline-offset-0!"
                >
                  ×
                </button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                {
                  label: "Total requests",
                  value: review.data?.total ?? 0,
                  caption: tabInfo.label,
                  icon: "book",
                },
                {
                  label: "Your review queue",
                  value: actionable,
                  caption: actionable ? "Ready for your decision" : "No decisions at your step",
                  icon: "briefcase",
                },
                {
                  label: "Completed",
                  value: requests.length - pending,
                  caption: "Approved or rejected",
                  icon: "calendar",
                },
              ].map((item) => (
                <section
                  key={item.label}
                  aria-label={item.label}
                  className="border-brand-border/20 min-w-0 rounded-xl border bg-white p-3 shadow-sm sm:p-5"
                >
                  <div className="text-brand-muted flex items-start justify-between gap-2">
                    <h2 className="text-xs font-semibold">{item.label}</h2>
                    <DashboardIcon name={item.icon} className="hidden size-5 shrink-0 sm:block" />
                  </div>
                  <p
                    className={`mt-3 font-bold ${review.isSuccess ? "text-3xl" : "text-xs sm:text-lg"} ${item.label === "Your review queue" ? "text-brand-maroon" : "text-brand-ink"}`}
                  >
                    {review.isSuccess ? item.value : review.loading ? "Loading" : "Unavailable"}
                  </p>
                  <p className="text-brand-muted mt-2 hidden text-xs sm:block">
                    {review.isSuccess
                      ? item.caption
                      : review.loading
                        ? "Loading request data"
                        : "Request data unavailable"}
                  </p>
                </section>
              ))}
            </div>
            <section
              className="border-brand-border/25 overflow-hidden rounded-xl border bg-white shadow-sm"
              aria-label="Request queue"
            >
              <div
                role="tablist"
                aria-label="Request categories"
                className="border-brand-border/20 flex overflow-x-auto border-b px-2 sm:px-4"
              >
                {REQUEST_TABS.map((item, index) => (
                  <button
                    key={item.kind}
                    id={`request-tab-${item.kind}`}
                    role="tab"
                    type="button"
                    aria-selected={tab === item.kind}
                    aria-controls={`request-panel-${item.kind}`}
                    tabIndex={tab === item.kind ? 0 : -1}
                    onClick={() => changeTab(item.kind)}
                    onKeyDown={(event) => tabKeyDown(event, index)}
                    className={`flex min-h-16 shrink-0 items-center gap-2 border-b-2 px-4 py-4 text-sm font-semibold focus-visible:-outline-offset-3! ${tab === item.kind ? "border-brand-maroon text-brand-maroon" : "text-brand-muted hover:text-brand-maroon border-transparent"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div
                id={`request-panel-${tab}`}
                role="tabpanel"
                aria-labelledby={`request-tab-${tab}`}
                tabIndex={0}
                className="focus-visible:-outline-offset-4"
              >
                <div className="border-brand-border/20 space-y-4 border-b px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold">{tabInfo.label} requests</h2>
                      <p className="text-brand-muted mt-1 text-xs leading-relaxed">
                        {tabInfo.description}
                      </p>
                    </div>
                    {tab === "overload" && role !== "dean" && (
                      <span className="text-brand-muted bg-brand-skeleton/10 rounded-full px-3 py-2 text-xs font-medium">
                        Read-only for your role
                      </span>
                    )}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,2fr)_minmax(140px,1fr)_minmax(130px,1fr)_minmax(130px,1fr)]">
                    <div>
                      <label htmlFor="request-search" className="mb-2 block text-xs font-semibold">
                        Search requests
                      </label>
                      <input
                        disabled={!review.isSuccess}
                        id="request-search"
                        type="search"
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          setPage(1);
                        }}
                        placeholder="Student, student number, course or request ID"
                        className={filterField}
                      />
                    </div>
                    <div>
                      <label htmlFor="request-status" className="mb-2 block text-xs font-semibold">
                        Status
                      </label>
                      <select
                        disabled={!review.isSuccess}
                        id="request-status"
                        value={status}
                        onChange={(event) => {
                          setStatus(event.target.value);
                          setPage(1);
                        }}
                        className={`${filterField} cursor-pointer`}
                      >
                        <option value="all">All statuses</option>
                        <option value="pending">Pending review</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="request-from" className="mb-2 block text-xs font-semibold">
                        Filed from
                      </label>
                      <input
                        disabled={!review.isSuccess}
                        id="request-from"
                        type="date"
                        value={fromDate}
                        max={toDate || undefined}
                        onChange={(event) => {
                          setFromDate(event.target.value);
                          setPage(1);
                        }}
                        className={`${filterField} min-w-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                        aria-invalid={dateInvalid || undefined}
                        aria-describedby={dateInvalid ? "request-date-error" : undefined}
                      />
                    </div>
                    <div>
                      <label htmlFor="request-to" className="mb-2 block text-xs font-semibold">
                        Filed until
                      </label>
                      <input
                        disabled={!review.isSuccess}
                        id="request-to"
                        type="date"
                        value={toDate}
                        min={fromDate || undefined}
                        onChange={(event) => {
                          setToDate(event.target.value);
                          setPage(1);
                        }}
                        className={`${filterField} min-w-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                        aria-invalid={dateInvalid || undefined}
                        aria-describedby={dateInvalid ? "request-date-error" : undefined}
                      />
                    </div>
                  </div>
                  {dateInvalid && (
                    <p id="request-date-error" role="alert" className="text-brand-maroon text-xs">
                      The start date must be on or before the end date.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-brand-muted text-xs" role="status">
                      {review.isSuccess
                        ? total + (total === 1 ? " request found" : " requests found")
                        : review.loading
                          ? "Loading requests…"
                          : "Request data unavailable"}
                      {hasFilters ? " with current filters" : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={clearFilters}
                        disabled={!hasFilters || !review.isSuccess}
                        className="text-brand-maroon disabled:text-brand-muted min-h-11 px-2 text-xs font-semibold focus-visible:outline-offset-0! disabled:cursor-default"
                      >
                        Clear filters
                      </button>
                      <label htmlFor="request-sort" className="sr-only">
                        Sort requests
                      </label>
                      <select
                        disabled={!review.isSuccess}
                        id="request-sort"
                        value={sort}
                        onChange={(event) => {
                          setSort(event.target.value);
                          setPage(1);
                        }}
                        className="border-brand-border/30 text-brand-muted min-h-11 cursor-pointer rounded-lg border px-3 py-2 text-xs focus-visible:outline-offset-0!"
                      >
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                      </select>
                    </div>
                  </div>
                </div>
                {!review.connected ? (
                  <div className="px-6 py-14 text-center">
                    <h3 className="text-base font-semibold">
                      Enrollment review is not available yet
                    </h3>
                    <p className="text-brand-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
                      Requests and review actions will be available once the service is connected.
                    </p>
                  </div>
                ) : review.loading ? (
                  <div className="p-6">
                    <DashboardLoading label="Loading enrollment requests" />
                  </div>
                ) : review.isError ? (
                  <div className="p-6">
                    <ErrorAlert
                      title="Requests could not be loaded"
                      error={review.error}
                      onRetry={() => void review.refetch()}
                      placement="inline"
                    />
                  </div>
                ) : visibleRequests.length ? (
                  <RequestsTable
                    requests={visibleRequests}
                    role={actualRole}
                    onOpen={setSelectedId}
                    rowNotices={review.rowNotices}
                  />
                ) : (
                  <div className="px-6 py-14 text-center">
                    <div className="bg-brand-skeleton/10 text-brand-muted mx-auto mb-4 grid size-12 place-items-center rounded-full">
                      <DashboardIcon name="book" />
                    </div>
                    <h3 className="text-base font-semibold">
                      {hasFilters ? "No matching requests" : "No requests to review"}
                    </h3>
                    <p className="text-brand-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
                      {hasFilters
                        ? "Try a different student name, status, or date range."
                        : "There are no requests in this category."}
                    </p>
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="text-brand-maroon mt-3 min-h-11 rounded-lg px-4 py-2 text-sm font-semibold"
                      >
                        Clear all filters
                      </button>
                    )}
                  </div>
                )}
                <div className="border-brand-border/20 text-brand-muted flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="request-page-size">Rows per page</label>
                    <select
                      disabled={!review.isSuccess}
                      id="request-page-size"
                      value={pageSize}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value));
                        setPage(1);
                      }}
                      className="border-brand-border/30 min-h-11 cursor-pointer rounded-lg border bg-white px-3 py-2 focus-visible:outline-offset-0!"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                    <span>
                      Showing {total ? (currentPage - 1) * pageSize + 1 : 0}-
                      {Math.min(currentPage * pageSize, total)} of {total}
                    </span>
                  </div>
                  <nav aria-label="Request pagination" className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                      className="border-brand-border/30 min-h-11 cursor-pointer rounded-lg border px-3 py-2 font-semibold focus-visible:outline-offset-0! disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span aria-current="page" className="px-2">
                      {currentPage} / {pages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === pages}
                      onClick={() => setPage(currentPage + 1)}
                      className="border-brand-border/30 min-h-11 cursor-pointer rounded-lg border px-3 py-2 font-semibold focus-visible:outline-offset-0! disabled:opacity-40"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </section>
            <p className="text-brand-muted text-xs leading-relaxed">
              {tab === "waivers"
                ? "Waivers follow three stages: Chair evaluation, Dean recommendation, and recording of the VPAA decision by the Registrar."
                : tab === "overload"
                  ? "College Deans decide overload requests. Chairs and the Registrar can view request details."
                  : "Chairs and Deans decide add and drop requests. The Registrar can view request details."}
            </p>
          </>
        )}
        {selected && actualRole && (
          <RequestReviewDialog
            key={selected.id}
            request={selected}
            role={actualRole}
            onClose={() => setSelectedId(null)}
            onSubmit={review.decide}
            submitting={review.submitting}
            isMock={review.isMock}
            readOnlyReason={review.rowNotices[selected.id]}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
