import type { EnrollmentRequest, RequestKind, RequestState, ReviewerRole } from "./types";

export const REVIEW_ROLES: Record<ReviewerRole, string> = {
  chairperson: "Department Chair",
  dean: "College Dean",
  registrar: "Registrar",
};

export const REQUEST_TABS: { kind: RequestKind; label: string; description: string }[] = [
  {
    kind: "add-drop",
    label: "Add and drop",
    description: "Review changes to a student's enrolled courses.",
  },
  {
    kind: "overload",
    label: "Overload",
    description: "Review requests to exceed the regular academic unit load.",
  },
  {
    kind: "waivers",
    label: "Co-requisite waivers",
    description: "Review prerequisite exceptions through the Chair, Dean, and Registrar stages.",
  },
];

export const STATE_LABELS: Record<RequestState, string> = {
  PENDING: "Pending review",
  PENDING_CHAIR: "Awaiting Chair",
  PENDING_DEAN: "Awaiting Dean",
  PENDING_VPAA: "Awaiting VPAA record",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function isReviewerRole(value: string | undefined): value is ReviewerRole {
  return value === "chairperson" || value === "dean" || value === "registrar";
}

export function isPending(state: RequestState) {
  return state.startsWith("PENDING");
}

/** Button visibility only. Permissions, data scope, and transitions are enforced by the backend. */
export function canReview(request: EnrollmentRequest, role: ReviewerRole) {
  if (!isPending(request.state)) return false;
  if (request.kind === "add-drop") return role === "chairperson" || role === "dean";
  if (request.kind === "overload") return role === "dean";
  return (
    (role === "chairperson" && request.state === "PENDING_CHAIR") ||
    (role === "dean" && request.state === "PENDING_DEAN") ||
    (role === "registrar" && request.state === "PENDING_VPAA")
  );
}

export function reviewActionLabel(request: EnrollmentRequest, role: ReviewerRole) {
  if (request.kind !== "waivers") return "Approve request";
  return {
    chairperson: "Evaluate and endorse",
    dean: "Recommend approval",
    registrar: "Record VPAA approval",
  }[role];
}

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Manila",
});
export function formatFiledDate(date: string) {
  return dateFormat.format(new Date(date));
}
export function manilaDate(date: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}
