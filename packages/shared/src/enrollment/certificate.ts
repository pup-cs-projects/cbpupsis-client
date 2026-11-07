import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";
import { decimal } from "./student";

export type CertificateStatus = "CURRENT" | "SUPERSEDED";

export interface CertificateTerm {
  /** The term's UUID, the selector every certificate call takes. */
  id: string;
  /** "2026-2027" */
  year: string;
  /** As stored: "first" or "First Semester". */
  semester: string;
}

export interface CertificateMeeting {
  /** Monday = 0 ... Sunday = 6. */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  /** "Lecture", "Laboratory", ... as the API sends it. */
  type: string;
}

export interface CertificateCourse {
  sectionId: string;
  code: string;
  title: string;
  section: string;
  schedule: CertificateMeeting[];
  /** Null when no room or faculty is assigned yet. */
  room: string | null;
  faculty: string | null;
  units: number;
}

export interface AssessmentLine {
  code: string;
  amount: number;
}

/** The stored assessment printed on the certificate. Every amount is in pesos. */
export interface Assessment {
  lines: AssessmentLine[];
  amountAssessed: number;
  subsidyApplied: number;
  netPayable: number;
  fheQualified: boolean;
  fheForfeited: boolean;
  fheForfeitureReason: string | null;
}

/** GET /student/schedule/cor?format=json: the issued certificate's immutable content. */
export interface Certificate {
  certificateId: string;
  /** An instant, ISO 8601. */
  issuedAt: string;
  status: CertificateStatus;
  name: string;
  studentNumber: string;
  program: string;
  term: CertificateTerm;
  courses: CertificateCourse[];
  totalUnits: number;
  assessment: Assessment;
  verificationUrl: string;
}

/** POST /student/schedule/cor (201): what was issued, not its content. */
export interface CertificateMetadata {
  certificateId: string;
  issuedAt: string;
  status: CertificateStatus;
}

/** GET /public/cor/verify/{token}: the five fields anyone may see. No ids, no assessment. */
export interface CertificateVerification {
  name: string;
  studentNumber: string;
  term: { year: string; semester: string };
  issuedAt: string;
  status: CertificateStatus;
}

/**
 * The signed-in student's Certificate of Registration (US-ENRL-003, API #100), and the public
 * check of a printed one. Refusals arrive as ApiError: 409 COR_NOT_ENROLLED, 409
 * COR_ENROLLMENT_NOT_FINAL (with `details.unmet`), 503 SERVICE_UNAVAILABLE; the verify call adds
 * 404 RESOURCE_NOT_FOUND and 429 rate_limited.
 */
export function createStudentCertificateApi(client: ApiClient) {
  function corPath(termId: string, format: "json" | "pdf") {
    return `/student/schedule/cor?${new URLSearchParams({ term: termId, format })}`;
  }

  return {
    /** The issued certificate as data, for the on-screen preview. Never issues one. */
    async read(accessToken: string, termId: string): Promise<Certificate> {
      const body = await client.request(corPath(termId, "json"), { method: "GET", accessToken });
      return parseCertificate(body);
    },

    /** The official PDF, rendered by the API. */
    async pdf(accessToken: string, termId: string): Promise<Blob> {
      return client.requestBlob(corPath(termId, "pdf"), { accessToken });
    },

    /** Issues the certificate. A retry returns the same certificate, never a second one. */
    async issue(accessToken: string, termId: string): Promise<CertificateMetadata> {
      const body = await client.request("/student/schedule/cor", {
        method: "POST",
        accessToken,
        body: { term: termId },
      });
      return parseMetadata(body);
    },

    /** Anyone, signed in or not, checks a printed certificate by its token. */
    async verify(token: string): Promise<CertificateVerification> {
      const body = await client.request(`/public/cor/verify/${encodeURIComponent(token)}`, {
        method: "GET",
      });
      const v = parse.record(body);
      const term = parse.record(v.term);
      return {
        name: parse.string(v.name),
        studentNumber: parse.string(v.studentNumber),
        term: { year: parse.string(term.year), semester: parse.string(term.semester) },
        issuedAt: parse.string(v.issuedAt),
        status: parseStatus(v.status),
      };
    },
  };
}

export type StudentCertificateApi = ReturnType<typeof createStudentCertificateApi>;

/** The unmet items a COR_ENROLLMENT_NOT_FINAL refusal names: HOLD, PREREQUISITE_VIOLATION, ... */
export function unmetItems(details: Record<string, unknown> | undefined): string[] {
  const unmet = details?.unmet;
  return Array.isArray(unmet) ? unmet.filter((item) => typeof item === "string") : [];
}

function parseStatus(value: unknown): CertificateStatus {
  return parse.oneOf(value, ["CURRENT", "SUPERSEDED"] as const);
}

function parseMetadata(value: unknown): CertificateMetadata {
  const m = parse.record(value);
  return {
    certificateId: parse.string(m.certificateId),
    issuedAt: parse.string(m.issuedAt),
    status: parseStatus(m.status),
  };
}

function parseMeeting(value: unknown): CertificateMeeting {
  const m = parse.record(value);
  const day = parse.nonNegativeInteger(m.dayOfWeek);
  return {
    dayOfWeek: day <= 6 ? day : parse.invalid(),
    startTime: parse.string(m.startTime),
    endTime: parse.string(m.endTime),
    room: parse.optionalString(m.room),
    type: parse.string(m.type),
  };
}

function parseCourse(value: unknown): CertificateCourse {
  const c = parse.record(value);
  return {
    sectionId: parse.string(c.sectionId),
    code: parse.string(c.code),
    title: parse.string(c.title),
    section: parse.string(c.section),
    schedule: parse.array(c.schedule).map(parseMeeting),
    room: parse.optionalString(c.room),
    faculty: parse.optionalString(c.faculty),
    units: decimal(c.units),
  };
}

function parseAssessment(value: unknown): Assessment {
  const a = parse.record(value);
  return {
    lines: parse.array(a.lines).map((line) => {
      const l = parse.record(line);
      return { code: parse.string(l.code), amount: decimal(l.amount) };
    }),
    amountAssessed: decimal(a.amountAssessed),
    subsidyApplied: decimal(a.subsidyApplied),
    netPayable: decimal(a.netPayable),
    fheQualified: parse.boolean(a.fheQualified),
    fheForfeited: parse.boolean(a.fheForfeited),
    fheForfeitureReason: parse.optionalString(a.fheForfeitureReason),
  };
}

function parseCertificate(value: unknown): Certificate {
  const c = parse.record(value);
  const term = parse.record(c.term);
  return {
    certificateId: parse.string(c.certificateId),
    issuedAt: parse.string(c.issuedAt),
    status: parseStatus(c.status),
    name: parse.string(c.name),
    studentNumber: parse.string(c.studentNumber),
    program: parse.string(c.program),
    term: {
      id: parse.string(term.id),
      year: parse.string(term.year),
      semester: parse.string(term.semester),
    },
    courses: parse.array(c.courses).map(parseCourse),
    totalUnits: decimal(c.totalUnits),
    assessment: parseAssessment(c.assessment),
    verificationUrl: parse.string(c.verificationUrl),
  };
}
