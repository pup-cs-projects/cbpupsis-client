/** UI models returned by the adapter. Normalize backend responses at that boundary. */
export type RequestKind = "add-drop" | "overload" | "waivers";
export type ReviewerRole = "chairperson" | "dean" | "registrar";
export type RequestState =
  "PENDING" | "PENDING_CHAIR" | "PENDING_DEAN" | "PENDING_VPAA" | "APPROVED" | "REJECTED";
export type Decision = "APPROVE" | "REJECT";

export interface CourseChange {
  code: string;
  title: string;
  section: string;
  units: number;
  action: "ADD" | "DROP" | "WAIVER";
  reason?: string;
}

export interface ReviewHistory {
  role: ReviewerRole;
  decision: Decision;
  remarks: string;
  occurredAt: string;
  vpaaReference?: string;
}

export interface EnrollmentRequest {
  id: string;
  kind: RequestKind;
  student: { name: string; number: string; program: string; year: string };
  filedAt: string;
  state: RequestState;
  version: number;
  summary: string;
  justification: string;
  courses: CourseChange[];
  unitsBefore: number;
  unitsAfter: number;
  condition?: "REPEATED_PREREQUISITE" | "SUPERIOR_STANDING" | "GRADUATING";
  prerequisite?: string;
  history: ReviewHistory[];
}

export interface ReviewSubmission {
  requestId: string;
  decision: Decision;
  remarks: string;
  vpaaReference: string;
  version: number;
}

export interface EnrollmentReviewDataSource {
  /** Only development adapters set this; backend adapters may omit it. */
  readonly isMock?: boolean;
  /** Return the backend-scoped list. Abort obsolete loads when signal is aborted. */
  list(kind: RequestKind, signal: AbortSignal): Promise<EnrollmentRequest[]>;
  /** Return the updated server record after its decision is committed. */
  decide(kind: RequestKind, submission: ReviewSubmission): Promise<EnrollmentRequest>;
}
