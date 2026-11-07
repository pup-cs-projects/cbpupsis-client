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
    termType: "REGULAR" as const,
    prescribedLoad: 26,
    approvedOverloadUnits: 0,
    standingReduction: 0,
    effectiveCeiling: 26,
    academicStanding: "Good Standing",
    overloadEligible: false,
    summerSubjectCap: null,
    holds: [],
    academicPeriod: period,
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
  it("shows the API's own sentence when it sent one, over any fixed wording", () => {
    const error = new ApiError(409, "ENROLL_UNIT_CEILING_EXCEEDED", {
      detail: "This goes over your limit of 26 units. You have 3 units left.",
    });
    expect(refusalMessage(error)).toBe(
      "This goes over your limit of 26 units. You have 3 units left.",
    );
  });

  it("falls back to the fixed overload-cap sentence when the API sent no words", () => {
    const error = new ApiError(409, "ENROLL_OVERLOAD_CAP_EXCEEDED", {});
    expect(refusalMessage(error)).toBe("An overload can add at most 9 units.");
  });

  it("falls back to the fixed section-full sentence when the API sent no words", () => {
    const error = new ApiError(409, "ENROLL_SECTION_FULL", {});
    expect(refusalMessage(error)).toBe("This section just filled up. Pick another section.");
  });

  it("builds the summer-subject sentence from the student's own cap, never a fixed number", () => {
    const error = new ApiError(409, "ENROLL_SUMMER_SUBJECT_LIMIT", {});
    expect(refusalMessage(error, 2)).toBe("Summer allows at most 2 subjects for you.");
    expect(refusalMessage(error, 4)).toBe("Summer allows at most 4 subjects for you.");
  });

  it("falls back to a generic sentence for an error the client does not specially know", () => {
    expect(refusalMessage(new ApiError(500, "SOMETHING_NEW"))).toMatch(/Try again/);
  });
});
