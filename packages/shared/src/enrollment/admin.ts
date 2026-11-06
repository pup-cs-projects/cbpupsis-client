/** Wire contracts from backend docs/openapi.json. No UI-only fields.
 * Overload: fr003 918b439; add/drop: PR #211 fb0e421; waivers: PR #213 c0b5c26.
 * Optional properties follow OpenAPI required/default semantics. Decimal units stay strings.
 * Waiver state/condition are strings in PR #213; the UI mapper validates supported values.
 */
export interface OverloadRequestRead {
  overloadRequestId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  programCode: string;
  department: string;
  college: string | null;
  term: string;
  requestedUnits: number;
  justification: string;
  state: "PENDING_DEAN" | "APPROVED" | "REJECTED";
  reviewedBy?: string | null;
  remarks?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface OverloadDecisionRequest {
  decision: "APPROVE" | "REJECT";
  remarks?: string | null;
}

export interface AddDropCourseRead {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  units: string;
  tag: "PENDING_ADD" | "PENDING_DROP";
  reason?: string | null;
}

export interface AdminAddDropRequestRead {
  requestId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  programCode: string;
  department: string;
  college: string | null;
  term: string;
  academicTermId: string;
  state: "PENDING" | "APPROVED" | "REJECTED";
  unitsBefore: string;
  unitsAfter: string;
  comments?: string | null;
  remarks?: string | null;
  version?: number;
  courses?: Array<AddDropCourseRead>;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export interface AddDropDecisionRequest {
  decision: "APPROVE" | "REJECT";
  remarks?: string | null;
  version?: number;
}

export interface WaiverRead {
  waiverRequestId: string;
  state: string;
  studentId: string;
  sectionId: string;
  prerequisiteCourseCode: string;
  condition: string;
  justification: string;
  reviewRemarks: string | null;
  vpaaReference: string | null;
  createdAt: string;
}

export interface Page_WaiverRead_ {
  items: Array<WaiverRead>;
  total: number;
  limit: number;
  offset: number;
}

export interface WaiverDecision {
  decision: "APPROVE" | "REJECT";
  remarks?: string | null;
  vpaaReference?: string | null;
}

export type WaiverPage = Page_WaiverRead_;
