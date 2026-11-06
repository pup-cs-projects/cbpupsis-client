import type {
  AdminAddDropRequestRead,
  OverloadRequestRead,
  WaiverPage,
} from "@cbpupsis/shared/enrollment";

/** Fictional wire responses, constructed lazily and excluded from production. */
export function createMockRequests(): {
  addDrop: AdminAddDropRequestRead[];
  overload: OverloadRequestRead[];
  waivers: WaiverPage;
} {
  const names = [
    "Andrea Reyes",
    "Miguel Santos",
    "Isabella Cruz",
    "Gabriel Lim",
    "Sofia Garcia",
    "Daniel Ramos",
  ];
  const id = (group: number, index: number) =>
    `${group}0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  const base = (name: string, index: number) => ({
    studentId: id(4, index),
    studentNumber: `DEMO-2026-${String(index + 1).padStart(4, "0")}`,
    studentName: name,
    programCode: "BSCS",
    department: "Computer Science",
    college: "College of Computer and Information Sciences",
    term: "First Semester 2026–2027",
    createdAt: `2026-11-${String(3 - Math.floor(index / 2)).padStart(2, "0")}T08:15:00+08:00`,
    remarks:
      index === 4
        ? "Approved after review."
        : index === 5
          ? "The submitted justification does not support this request."
          : null,
    reviewedBy: index >= 4 ? id(7, 0) : null,
    reviewedAt: index >= 4 ? "2026-11-04T03:00:00Z" : null,
  });
  const addDrop: AdminAddDropRequestRead[] = names.map((name, index) => ({
    ...base(name, index),
    requestId: id(1, index),
    academicTermId: id(8, 0),
    state: index < 4 ? "PENDING" : index === 4 ? "APPROVED" : "REJECTED",
    unitsBefore: "21.0",
    unitsAfter: "21.0",
    version: index < 4 ? 1 : 2,
    comments: "Requesting a section transfer to avoid a laboratory schedule conflict.",
    courses: [
      {
        sectionId: id(5, index),
        courseCode: "COMP 201",
        courseTitle: "Data Structures and Algorithms",
        units: "3.0",
        tag: "PENDING_ADD",
        reason: null,
      },
      {
        sectionId: id(6, index),
        courseCode: "COMP 201",
        courseTitle: "Data Structures and Algorithms",
        units: "3.0",
        tag: "PENDING_DROP",
        reason: "Laboratory schedule conflict.",
      },
    ],
  }));
  const overload: OverloadRequestRead[] = names.map((name, index) => ({
    ...base(name, index),
    overloadRequestId: id(2, index),
    requestedUnits: 27,
    justification: "Requesting an additional subject to complete remaining program requirements.",
    state: index < 4 ? "PENDING_DEAN" : index === 4 ? "APPROVED" : "REJECTED",
  }));
  const states = [
    "PENDING_CHAIR",
    "PENDING_DEAN",
    "PENDING_VPAA",
    "PENDING_CHAIR",
    "APPROVED",
    "REJECTED",
  ];
  const conditions = ["REPEATED_PREREQUISITE", "SUPERIOR_STANDING", "GRADUATING"];
  const items = names.map((name, index) => ({
    waiverRequestId: id(3, index),
    state: states[index],
    studentId: id(4, index),
    sectionId: id(5, index),
    prerequisiteCourseCode: "COMP 201",
    condition: conditions[index % conditions.length],
    justification: "Requesting permission to take the prerequisite alongside the subject.",
    reviewRemarks:
      index === 0 || index === 3
        ? null
        : index === 5
          ? "Supporting academic requirements were not met."
          : "Supporting records reviewed.",
    vpaaReference: index === 4 ? "DEMO-VPAA-2026-001" : null,
    createdAt: base(name, index).createdAt,
  }));
  return { addDrop, overload, waivers: { items, total: items.length, limit: 50, offset: 0 } };
}
