import { describe, expect, it } from "vitest";

import type { StudentGrades, TermGrades } from "./gradesTypes";
import { latestGradedTerm, transcriptTerms } from "./useGrades";

function record(academicYear: string, semester: TermGrades["semester"], gpa: string | null) {
  return {
    termId: `${academicYear} ${semester}`,
    academicYear,
    semester,
    gpa,
    standingStatus: "Good Standing",
    isAppealOpen: false,
    appealDeadlineDays: null,
    grades: [],
  } satisfies TermGrades;
}

function transcript(terms: TermGrades[]): StudentGrades {
  return {
    summary: { latestGpa: null, cumulativeGwa: null, totalUnitsEarned: 0, exclusionNote: "" },
    entryTerm: { academicYear: "2024–2025", semester: "First Semester" },
    currentTerm: { academicYear: "2025–2026", semester: "Second Semester" },
    terms,
  };
}

const labels = (terms: TermGrades[]) => terms.map((t) => `${t.academicYear} ${t.semester}`);

describe("transcriptTerms", () => {
  it("lists two semesters a year from the entry term to the current one, newest first", () => {
    expect(labels(transcriptTerms(transcript([])))).toEqual([
      "2025–2026 Second Semester",
      "2025–2026 First Semester",
      "2024–2025 Second Semester",
      "2024–2025 First Semester",
    ]);
  });

  it("leaves out records after the current term", () => {
    const terms = transcriptTerms(
      transcript([
        record("2026–2027", "First Semester", null),
        record("2025–2026", "Second Semester", "1.25"),
      ]),
    );
    expect(labels(terms)).not.toContain("2026–2027 First Semester");
    expect(terms[0].gpa).toBe("1.25");
  });

  it("keeps a term with no record, with no grades", () => {
    const terms = transcriptTerms(transcript([record("2025–2026", "Second Semester", "1.25")]));
    expect(terms[1]).toMatchObject({ semester: "First Semester", gpa: null, grades: [] });
  });

  it("matches records whose academic year uses a hyphen", () => {
    const terms = transcriptTerms(transcript([record("2024-2025", "Second Semester", "1.75")]));
    expect(terms[2].gpa).toBe("1.75");
  });
});

describe("latestGradedTerm", () => {
  it("opens on the newest term with a GPA", () => {
    const terms = transcriptTerms(
      transcript([
        record("2025–2026", "Second Semester", null),
        record("2025–2026", "First Semester", "1.50"),
      ]),
    );
    expect(latestGradedTerm(terms)?.termId).toBe("2025–2026 First Semester");
  });
});
