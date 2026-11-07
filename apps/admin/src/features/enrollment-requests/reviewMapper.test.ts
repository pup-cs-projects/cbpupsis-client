import { ApiError } from "@cbpupsis/shared/api";
import { describe, expect, it, vi } from "vitest";

import { createEnrollmentReviewDataSource } from "./dataSource";
import { createMockRequests } from "./mockData";
import { toEnrollmentRequest, toReviewSubmission } from "./reviewMapper";
import type { EnrollmentReviewTransport } from "./types";

describe("Enrollment wire adapter", () => {
  it("AC-ENRL-004.1: maps decimal units, tags and nullable review fields without inventing history", () => {
    const fixture = createMockRequests();
    const addDrop = toEnrollmentRequest({ kind: "add-drop", data: fixture.addDrop[0] });
    expect(addDrop.unitsBefore).toBe("21.0");
    expect(addDrop.courses.map((item) => item.action)).toEqual(["ADD", "DROP"]);
    expect(addDrop.courses[0].section).toBe(fixture.addDrop[0].courses![0].sectionId);
    expect(addDrop).not.toHaveProperty("history");
    const overload = toEnrollmentRequest({ kind: "overload", data: fixture.overload[0] });
    expect(overload.requestedUnits).toBe(27);
    expect(overload).not.toHaveProperty("version");
    expect(overload).not.toHaveProperty("unitsBefore");
    expect(overload.courses).toEqual([]);
    const waiver = toEnrollmentRequest({ kind: "waivers", data: fixture.waivers.items[1] });
    expect(waiver.student).toEqual({ id: fixture.waivers.items[1].studentId });
    expect(waiver.lastDecision).toEqual({
      remarks: "Supporting records reviewed.",
      vpaaReference: null,
    });
    expect(waiver).not.toHaveProperty("version");
  });

  it("AC-ENRL-004.5: decision bodies only include fields accepted by their endpoint", () => {
    const fixture = createMockRequests();
    const addDrop = toReviewSubmission(
      toEnrollmentRequest({ kind: "add-drop", data: fixture.addDrop[0] }),
      "REJECT",
      "Reason",
      "should not be sent",
    );
    expect(addDrop.body).toEqual({ decision: "REJECT", remarks: "Reason", version: 1 });
    const overload = toReviewSubmission(
      toEnrollmentRequest({ kind: "overload", data: fixture.overload[0] }),
      "APPROVE",
      "",
      "should not be sent",
    );
    expect(overload.body).toEqual({ decision: "APPROVE" });
    const waiver = toReviewSubmission(
      toEnrollmentRequest({ kind: "waivers", data: fixture.waivers.items[2] }),
      "APPROVE",
      "",
      " VPAA-1 ",
    );
    expect(waiver.body).toEqual({ decision: "APPROVE", vpaaReference: "VPAA-1" });
  });

  it("AC-ENRL-004.1: malformed decimal units or unknown waiver states fail at the boundary", () => {
    const fixture = createMockRequests();
    expect(() =>
      toEnrollmentRequest({
        kind: "add-drop",
        data: { ...fixture.addDrop[0], unitsBefore: "unknown" },
      }),
    ).toThrow(ApiError);
    expect(() =>
      toEnrollmentRequest({
        kind: "waivers",
        data: { ...fixture.waivers.items[0], state: "NEW_UNKNOWN_STAGE" },
      }),
    ).toThrow(ApiError);
  });

  it("AC-ENRL-004.1: follows waiver items/total/offset across pages and honors cancellation", async () => {
    const fixtures = createMockRequests();
    const listWaivers = vi.fn<EnrollmentReviewTransport["listWaivers"]>(async ({ offset }) => ({
      items: fixtures.waivers.items.slice(offset, offset + 2),
      total: 6,
      limit: 2,
      offset,
    }));
    const source = createEnrollmentReviewDataSource({
      listAddDrop: async () => fixtures.addDrop,
      listOverload: async () => fixtures.overload,
      listWaivers,
      decideAddDrop: async () => fixtures.addDrop[0],
      decideOverload: async () => fixtures.overload[0],
      decideWaiver: async () => fixtures.waivers.items[0],
    });
    const signal = new AbortController().signal;
    const list = await source.list("waivers", signal);
    expect(list.total).toBe(6);
    expect(list.items).toHaveLength(6);
    expect(listWaivers.mock.calls.map(([query]) => query.offset)).toEqual([0, 2, 4]);
    const controller = new AbortController();
    controller.abort();
    await expect(source.list("waivers", controller.signal)).rejects.toHaveProperty(
      "name",
      "AbortError",
    );
  });
});
