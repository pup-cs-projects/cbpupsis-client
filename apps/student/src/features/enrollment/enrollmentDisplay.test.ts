import { ApiError } from "@cbpupsis/shared/api";
import { describe, expect, it } from "vitest";

import {
  enrollmentStatusLabel,
  periodDateRange,
  periodDayCount,
  periodStartDate,
  refusalMessage,
  termTypeLabel,
} from "./enrollmentDisplay";

const period = { start: "2026-06-01T00:00:00Z", end: "2026-06-30T00:00:00Z", isOpen: true };

describe("termTypeLabel", () => {
  it("names a regular and a summer term", () => {
    expect(termTypeLabel("REGULAR")).toBe("Regular Term");
    expect(termTypeLabel("SUMMER")).toBe("Summer Term");
  });
});

describe("periodDateRange and periodStartDate", () => {
  it("formats the period's start and end, and its start alone, in Manila", () => {
    expect(periodDateRange(period)).toBe("June 1 - June 30, 2026");
    expect(periodStartDate(period)).toBe("June 1, 2026");
  });
});

describe("periodDayCount", () => {
  it("counts whole days from start through end, inclusive", () => {
    expect(periodDayCount(period)).toBe(30);
    expect(periodDayCount({ ...period, end: period.start })).toBe(1);
  });
});

describe("enrollmentStatusLabel", () => {
  const eligible = {
    isEligible: true,
    term: "2026-2027-First Semester",
    academicTermId: "00000000-0000-0000-0000-000000000001",
    termType: "REGULAR" as const,
    prescribedLoad: 26,
    approvedOverloadUnits: 0,
    pendingOverloadUnits: 0,
    standingReduction: 0,
    effectiveCeiling: 26,
    academicStanding: "Good Standing",
    overloadEligible: false,
    summerSubjectCap: null,
    holds: [],
    academicPeriod: period,
    reasons: [],
  };

  it("reads Open when the period is open and the student is eligible", () => {
    expect(enrollmentStatusLabel(eligible)).toBe("Open");
  });

  it("reads Closed when the period is not open, even if the student is eligible", () => {
    expect(
      enrollmentStatusLabel({ ...eligible, academicPeriod: { ...period, isOpen: false } }),
    ).toBe("Closed");
  });

  it("reads Not Eligible when the period is open but the student is not", () => {
    expect(enrollmentStatusLabel({ ...eligible, isEligible: false })).toBe("Not Eligible");
  });
});

describe("refusalMessage", () => {
  it("AC-ENRL-001.2: names the limit and the units left from the refusal's details", () => {
    const error = new ApiError(409, "ENROLL_UNIT_CEILING_EXCEEDED", {
      detail: "The selected load exceeds your enrollment unit ceiling.",
      details: { effectiveCeiling: "23", unitsRemaining: "2" },
    });
    expect(refusalMessage(error)).toBe(
      "This goes over your limit of 23 units. You have 2 units left.",
    );
  });

  it("shows the API's own sentence when a refusal comes without its details", () => {
    const error = new ApiError(409, "ENROLL_UNIT_CEILING_EXCEEDED", {
      detail: "The selected load exceeds your enrollment unit ceiling.",
    });
    expect(refusalMessage(error)).toBe("The selected load exceeds your enrollment unit ceiling.");
  });

  it("AC-ENRL-001.4: states the overload cap", () => {
    const error = new ApiError(409, "ENROLL_OVERLOAD_CAP_EXCEEDED", {
      details: { maximumOverloadUnits: "9" },
    });
    expect(refusalMessage(error)).toBe("An overload can add at most 9 units.");
    expect(refusalMessage(new ApiError(409, "ENROLL_OVERLOAD_CAP_EXCEEDED"))).toBe(
      "An overload can add at most 9 units.",
    );
  });

  it("AC-ENRL-001.11: falls back to the fixed section-full sentence", () => {
    const error = new ApiError(409, "ENROLL_SECTION_FULL", { details: { sectionId: "sec-1" } });
    expect(refusalMessage(error)).toBe("This section just filled up. Pick another section.");
  });

  it("AC-ENRL-001.8: builds the summer-subject sentence from the student's own cap", () => {
    const of = (cap: number) =>
      refusalMessage(
        new ApiError(409, "ENROLL_SUMMER_SUBJECT_LIMIT", { details: { summerSubjectCap: cap } }),
      );
    expect(of(2)).toBe("Summer allows at most 2 subjects for you.");
    expect(of(4)).toBe("Summer allows at most 4 subjects for you.");
  });

  it("AC-ENRL-001.9: names both courses and the overlap", () => {
    const error = new ApiError(409, "ENROLL_SCHEDULE_CONFLICT", {
      details: {
        courseCodes: ["COMP 016", "COMP 017"],
        sectionIds: ["sec-1", "sec-2"],
        overlap: { day: 0, start: "13:30:00", end: "15:00:00" },
      },
    });
    expect(refusalMessage(error)).toMatch(/^COMP 016 and COMP 017 overlap on Monday, 1:30/);
  });

  it("falls back to a generic sentence for an error the client does not specially know", () => {
    expect(refusalMessage(new ApiError(500, "SOMETHING_NEW"))).toMatch(/Try again/);
  });
});
