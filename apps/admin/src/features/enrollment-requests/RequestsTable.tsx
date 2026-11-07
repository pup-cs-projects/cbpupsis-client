import { canReview, formatFiledDate } from "./reviewRules";
import { StatusBadge } from "./StatusBadge";
import type { EnrollmentRequest, ReviewerRole } from "./types";

export function RequestsTable({
  requests,
  role,
  onOpen,
  rowNotices = {},
}: {
  requests: EnrollmentRequest[];
  role: ReviewerRole;
  rowNotices?: Record<string, string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Enrollment requests. Open a request to see its details and available review actions.
        </caption>
        <thead className="bg-brand-maroon text-xs text-white uppercase">
          <tr>
            {["Student", "Request details", "Filed on", "Status", "Action"].map((heading) => (
              <th scope="col" key={heading} className="px-5 py-4 font-semibold tracking-wide">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-brand-border/20 divide-y">
          {requests.map((request) => (
            <tr key={request.id} className="hover:bg-brand-paper/70 transition-colors">
              <th scope="row" className="min-w-52 px-5 py-5 break-words">
                <p className="font-semibold">{request.student.name ?? "Student ID"}</p>
                <p className="text-brand-muted mt-1 text-xs font-normal">
                  {request.student.number ?? request.student.id}
                </p>
                <p className="text-brand-muted mt-1 text-xs font-normal">
                  {request.student.program}
                </p>
              </th>
              <td className="min-w-52 px-5 py-5">
                <p className="text-brand-maroon text-xs font-semibold">{request.id}</p>
                <p className="mt-1 font-medium">{request.summary}</p>
                <p className="text-brand-muted mt-1 text-xs">
                  {request.kind === "overload"
                    ? `${request.requestedUnits} units requested`
                    : request.kind === "waivers"
                      ? `Prerequisite: ${request.prerequisite}`
                      : request.courses
                          .map((course) => course.code)
                          .filter((code, index, all) => all.indexOf(code) === index)
                          .join(", ")}
                </p>
              </td>
              <td className="text-brand-muted px-5 py-5 text-xs whitespace-nowrap">
                <time dateTime={request.filedAt}>{formatFiledDate(request.filedAt)}</time>
              </td>
              <td className="px-5 py-5">
                <StatusBadge state={request.state} />
                {rowNotices[request.id] && (
                  <p className="text-brand-maroon mt-2 max-w-64 text-xs" role="status">
                    {rowNotices[request.id]}
                  </p>
                )}
              </td>
              <td className="px-5 py-5">
                <button
                  type="button"
                  onClick={() => onOpen(request.id)}
                  aria-label={`${!rowNotices[request.id] && canReview(request, role) ? "Review" : "View"} request ${request.id}`}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap focus-visible:outline-offset-0! ${!rowNotices[request.id] && canReview(request, role) ? "text-brand-maroon bg-brand-maroon/5 hover:bg-brand-maroon/10" : "text-brand-help border-brand-border/30 hover:bg-brand-paper border"}`}
                >
                  {!rowNotices[request.id] && canReview(request, role) ? "Review" : "View details"}
                  <span aria-hidden="true">→</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
