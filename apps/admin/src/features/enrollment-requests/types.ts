import type {
  AddDropDecisionRequest,
  AdminAddDropRequestRead,
  OverloadDecisionRequest,
  OverloadRequestRead,
  WaiverDecision,
  WaiverPage,
  WaiverRead,
} from "@cbpupsis/shared/enrollment";

export type RequestKind = "add-drop" | "overload" | "waivers";
export type ReviewerRole = "chairperson" | "dean" | "registrar";
export type RequestState =
  "PENDING" | "PENDING_CHAIR" | "PENDING_DEAN" | "PENDING_VPAA" | "APPROVED" | "REJECTED";
export type Decision = "APPROVE" | "REJECT";
export type WaiverCondition = "REPEATED_PREREQUISITE" | "SUPERIOR_STANDING" | "GRADUATING";

export interface CourseChange {
  code: string;
  title: string;
  section: string;
  units: string;
  action: "ADD" | "DROP";
  reason?: string | null;
}

/** Only fields present in a wire response are mapped into this view model. */
export interface EnrollmentRequest {
  id: string;
  kind: RequestKind;
  student: { id: string; name?: string; number?: string; program?: string };
  filedAt: string;
  state: RequestState;
  version?: number;
  summary: string;
  justification: string | null;
  courses: CourseChange[];
  unitsBefore?: string;
  unitsAfter?: string;
  requestedUnits?: number;
  sectionId?: string;
  condition?: WaiverCondition;
  prerequisite?: string;
  term?: string;
  lastDecision?: {
    reviewedBy?: string | null;
    remarks: string | null;
    reviewedAt?: string | null;
    vpaaReference?: string | null;
  };
}

/** Each category sends exactly the decision body accepted by its endpoint. */
export type ReviewSubmission =
  | { kind: "add-drop"; requestId: string; body: AddDropDecisionRequest }
  | { kind: "overload"; requestId: string; body: OverloadDecisionRequest }
  | { kind: "waivers"; requestId: string; body: WaiverDecision };

export interface EnrollmentRequestList {
  items: EnrollmentRequest[];
  total: number;
}

/** The wire transport. The real one is authenticated; the API scopes what it returns. */
export interface EnrollmentReviewTransport {
  listAddDrop(signal: AbortSignal): Promise<AdminAddDropRequestRead[]>;
  listOverload(signal: AbortSignal): Promise<OverloadRequestRead[]>;
  listWaivers(page: { limit: number; offset: number }, signal: AbortSignal): Promise<WaiverPage>;
  decideAddDrop(id: string, body: AddDropDecisionRequest): Promise<AdminAddDropRequestRead>;
  decideOverload(id: string, body: OverloadDecisionRequest): Promise<OverloadRequestRead>;
  decideWaiver(id: string, body: WaiverDecision): Promise<WaiverRead>;
}

export interface EnrollmentReviewDataSource {
  readonly isMock?: boolean;
  list(kind: RequestKind, signal: AbortSignal): Promise<EnrollmentRequestList>;
  decide(submission: ReviewSubmission): Promise<EnrollmentRequest>;
}
