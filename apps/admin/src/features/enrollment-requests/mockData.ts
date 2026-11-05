import type { EnrollmentRequest, RequestKind, RequestState, ReviewHistory } from "./types";

/** Fictional development records. Created lazily so production can drop this module. */
export function createMockRequests(): EnrollmentRequest[] {
  const students = [
    {
      name: "Andrea Reyes",
      number: "DEMO-2026-0001",
      program: "BS Computer Science",
      year: "2nd year",
    },
    {
      name: "Miguel Santos",
      number: "DEMO-2026-0002",
      program: "BS Computer Science",
      year: "3rd year",
    },
    {
      name: "Isabella Cruz",
      number: "DEMO-2026-0003",
      program: "BS Computer Science",
      year: "4th year",
    },
    {
      name: "Gabriel Lim",
      number: "DEMO-2026-0004",
      program: "BS Computer Science",
      year: "2nd year",
    },
    {
      name: "Sofia Garcia",
      number: "DEMO-2026-0005",
      program: "BS Computer Science",
      year: "3rd year",
    },
    {
      name: "Daniel Ramos",
      number: "DEMO-2026-0006",
      program: "BS Computer Science",
      year: "4th year",
    },
  ];

  return (["add-drop", "overload", "waivers"] as RequestKind[]).flatMap((kind) =>
    students.map((student, index) => {
      const waiverStates: RequestState[] = [
        "PENDING_CHAIR",
        "PENDING_DEAN",
        "PENDING_VPAA",
        "PENDING_CHAIR",
        "APPROVED",
        "REJECTED",
      ];
      const state: RequestState =
        kind === "waivers"
          ? waiverStates[index]
          : index < 4
            ? "PENDING"
            : index === 4
              ? "APPROVED"
              : "REJECTED";
      const history: ReviewHistory[] = [];
      if (kind === "waivers" && ["PENDING_DEAN", "PENDING_VPAA", "APPROVED"].includes(state))
        history.push({
          role: "chairperson",
          decision: "APPROVE",
          remarks: "Supporting academic records reviewed.",
          occurredAt: "2026-11-04T01:00:00Z",
        });
      if (kind === "waivers" && ["PENDING_VPAA", "APPROVED"].includes(state))
        history.push({
          role: "dean",
          decision: "APPROVE",
          remarks: "Recommended for approval.",
          occurredAt: "2026-11-04T02:00:00Z",
        });
      if (state === "APPROVED")
        history.push({
          role: kind === "waivers" ? "registrar" : "dean",
          decision: "APPROVE",
          remarks: "Approved after review.",
          occurredAt: "2026-11-04T03:00:00Z",
          ...(kind === "waivers" ? { vpaaReference: "DEMO-VPAA-2026-001" } : {}),
        });
      if (state === "REJECTED")
        history.push({
          role: kind === "overload" ? "dean" : "chairperson",
          decision: "REJECT",
          remarks: "The submitted justification does not support this request.",
          occurredAt: "2026-11-04T03:30:00Z",
        });

      return {
        id: `DEMO-${kind === "add-drop" ? "AD" : kind === "overload" ? "OL" : "WV"}-${String(index + 1).padStart(4, "0")}`,
        kind,
        student,
        state,
        version: history.length + 1,
        filedAt: `2026-11-${String(3 - Math.floor(index / 2)).padStart(2, "0")}T0${8 - index}:15:00+08:00`,
        summary:
          kind === "add-drop"
            ? "Add 1 course · Drop 1 course"
            : kind === "overload"
              ? "+3 units requested"
              : "Co-requisite exception",
        justification:
          kind === "add-drop"
            ? "I am requesting a transfer to a section that does not conflict with my laboratory schedule."
            : kind === "overload"
              ? "The additional subject will let me complete my remaining program requirements within this academic year."
              : "I am requesting to take this prerequisite alongside the subject to complete my graduation requirements on time.",
        unitsBefore: kind === "overload" ? 24 : 21,
        unitsAfter: kind === "overload" ? 27 : 21,
        courses:
          kind === "add-drop"
            ? [
                {
                  code: "COMP 201",
                  title: "Data Structures and Algorithms",
                  section: "BSCS 2-1",
                  units: 3,
                  action: "ADD" as const,
                },
                {
                  code: "COMP 201",
                  title: "Data Structures and Algorithms",
                  section: "BSCS 2-2",
                  units: 3,
                  action: "DROP" as const,
                  reason: "Laboratory schedule conflict.",
                },
              ]
            : [
                {
                  code: kind === "overload" ? "COMP 405" : "COMP 302",
                  title:
                    kind === "overload" ? "Software Engineering" : "Database Management Systems",
                  section: "BSCS 3-1",
                  units: 3,
                  action: kind === "overload" ? ("ADD" as const) : ("WAIVER" as const),
                },
              ],
        ...(kind === "waivers"
          ? { condition: "GRADUATING" as const, prerequisite: "COMP 201" }
          : {}),
        history,
      };
    }),
  );
}
