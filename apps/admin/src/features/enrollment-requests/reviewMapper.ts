import { ApiError } from "@cbpupsis/shared/api";
import type {
  AdminAddDropRequestRead,
  OverloadRequestRead,
  WaiverRead,
} from "@cbpupsis/shared/enrollment";

import type {
  Decision,
  EnrollmentRequest,
  RequestState,
  ReviewSubmission,
  WaiverCondition,
} from "./types";

type WireRequest =
  | { kind: "add-drop"; data: AdminAddDropRequestRead }
  | { kind: "overload"; data: OverloadRequestRead }
  | { kind: "waivers"; data: WaiverRead };

const waiverStates: RequestState[] = [
  "PENDING_CHAIR",
  "PENDING_DEAN",
  "PENDING_VPAA",
  "APPROVED",
  "REJECTED",
];
const conditions: WaiverCondition[] = ["REPEATED_PREREQUISITE", "SUPERIOR_STANDING", "GRADUATING"];

function decimal(value: string): string {
  if (
    typeof value !== "string" ||
    !/^[+-]?\d+(?:\.\d+)?$/.test(value) ||
    !Number.isFinite(Number(value))
  )
    throw new ApiError(0, "INVALID_RESPONSE");
  return value;
}

export function toEnrollmentRequest(wire: WireRequest): EnrollmentRequest {
  const data = wire.data;
  const common = { filedAt: data.createdAt, courses: [], justification: null };
  if (wire.kind === "waivers") {
    const item = wire.data;
    if (
      !waiverStates.includes(item.state as RequestState) ||
      !conditions.includes(item.condition as WaiverCondition)
    )
      throw new ApiError(0, "INVALID_RESPONSE");
    return {
      ...common,
      id: item.waiverRequestId,
      kind: wire.kind,
      student: { id: item.studentId },
      state: item.state as RequestState,
      summary: "Prerequisite exception",
      justification: item.justification,
      sectionId: item.sectionId,
      prerequisite: item.prerequisiteCourseCode,
      condition: item.condition as WaiverCondition,
      ...(item.reviewRemarks || item.vpaaReference
        ? { lastDecision: { remarks: item.reviewRemarks, vpaaReference: item.vpaaReference } }
        : {}),
    };
  }
  const item = wire.data;
  const student = {
    id: item.studentId,
    name: item.studentName,
    number: item.studentNumber,
    program: item.programCode,
  };
  const lastDecision =
    item.reviewedAt || item.reviewedBy || item.remarks
      ? { reviewedBy: item.reviewedBy, reviewedAt: item.reviewedAt, remarks: item.remarks ?? null }
      : undefined;
  if (wire.kind === "overload") {
    return {
      ...common,
      id: wire.data.overloadRequestId,
      kind: wire.kind,
      student,
      state: wire.data.state,
      summary: `${wire.data.requestedUnits} units requested`,
      requestedUnits: wire.data.requestedUnits,
      justification: wire.data.justification,
      term: item.term,
      lastDecision,
    };
  }
  const request = wire.data;
  const courses = (request.courses ?? []).map((course) => ({
    code: course.courseCode,
    title: course.courseTitle,
    section: course.sectionId,
    units: decimal(course.units),
    action: course.tag === "PENDING_ADD" ? ("ADD" as const) : ("DROP" as const),
    reason: course.reason,
  }));
  return {
    ...common,
    id: request.requestId,
    kind: wire.kind,
    student,
    state: request.state,
    version: request.version ?? 1,
    term: request.term,
    summary: `Add ${courses.filter((c) => c.action === "ADD").length} · Drop ${courses.filter((c) => c.action === "DROP").length}`,
    justification: request.comments ?? null,
    courses,
    unitsBefore: decimal(request.unitsBefore),
    unitsAfter: decimal(request.unitsAfter),
    lastDecision,
  };
}

export function toReviewSubmission(
  request: EnrollmentRequest,
  decision: Decision,
  remarks: string,
  vpaaReference: string,
): ReviewSubmission {
  const body = { decision, ...(remarks.trim() ? { remarks: remarks.trim() } : {}) };
  if (request.kind === "add-drop") {
    if (request.version === undefined) throw new ApiError(0, "INVALID_RESPONSE");
    return {
      kind: request.kind,
      requestId: request.id,
      body: { ...body, version: request.version },
    };
  }
  if (request.kind === "waivers")
    return {
      kind: request.kind,
      requestId: request.id,
      body: { ...body, ...(vpaaReference.trim() ? { vpaaReference: vpaaReference.trim() } : {}) },
    };
  return { kind: request.kind, requestId: request.id, body };
}
