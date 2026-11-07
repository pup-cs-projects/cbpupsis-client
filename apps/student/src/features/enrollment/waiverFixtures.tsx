import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

import type { BlockedSection } from "@cbpupsis/shared/enrollment";

import { signInDirectly } from "../../test/fixtures";

export const LIST_ROUTE = "GET /student/enrollment/waiver";
export const FILE_ROUTE = "POST /student/enrollment/waiver";

export const SECTION_ID = "10000000-0000-4000-8000-000000000001";
export const WAIVER_ID = "20000000-0000-4000-8000-000000000001";

/** A section blocked by COMP 003 (Inc), where a waiver is possible. */
export function blockedSection(overrides: Partial<BlockedSection> = {}): BlockedSection {
  return {
    sectionId: SECTION_ID,
    courseCode: "COMP 009",
    prerequisitesSatisfied: false,
    blockReason: "COMP 003: Inc; required range 1.00-3.00.",
    blocks: [
      {
        rule: "ENROLL_PREREQUISITE_NOT_MET",
        courseCode: "COMP 003",
        blockingMark: "Inc",
        requiredRange: "1.00-3.00",
        details: {},
      },
    ],
    waiverAvailable: true,
    ...overrides,
  };
}

export function waiver(overrides: Record<string, unknown> = {}) {
  return {
    waiverRequestId: WAIVER_ID,
    state: "PENDING_CHAIR",
    studentId: "6f1c1e8e-0000-4000-8000-000000000001",
    sectionId: SECTION_ID,
    prerequisiteCourseCode: "COMP 003",
    condition: "REPEATED_PREREQUISITE",
    justification: "I am retaking COMP 003 this term.",
    reviewRemarks: null,
    vpaaReference: null,
    createdAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

export function renderSignedIn(ui: ReactElement) {
  signInDirectly();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
