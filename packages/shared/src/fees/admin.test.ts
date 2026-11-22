import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import {
  createAdminFeeApi,
  formatHundredths,
  installmentTotal,
  isFeeAmount,
  percentHundredths,
  refusedDatePair,
  refusedFeeField,
  termLabel,
} from "./admin";

const api = createAdminFeeApi(createApiClient("http://api.test/api/v1"));
const termId = "30000000-0000-4000-8000-000000000001";
const structure = {
  academicTermId: termId,
  tuitionPerUnit: "0.00",
  programTuitionRates: [
    { programId: "50000000-0000-4000-8000-000000000001", tuitionPerUnit: "550.00" },
  ],
  registrationFee: "1250.00",
  labFee: "3500.00",
  miscFee: "800.00",
  lateFeeRate: "3.50",
  dueDate: "2026-08-15",
  subsidyCoveredFees: ["TUITION", "LAB"],
  installments: [
    { installmentNumber: 1, percentage: "40.00", dueDate: "2026-09-15" },
    { installmentNumber: 2, percentage: "60.00", dueDate: "2026-10-15" },
  ],
};

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("admin fee structure API (US-FIN-003)", () => {
  it("AC-FIN-003.1: reads a term's structure with decimal strings", async () => {
    const fetchMock = respond(200, structure);
    await expect(api.get("token", termId)).resolves.toEqual(structure);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`http://api.test/api/v1/admin/fee-structures/${termId}`);
    expect(init.method).toBe("GET");
  });

  it("reads the term and program options", async () => {
    const options = {
      terms: [
        {
          id: termId,
          academicYear: "2026-2027",
          semester: "FIRST_SEMESTER",
          isCurrent: true,
          hasFeeStructure: false,
        },
      ],
      programs: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          code: "BSCS",
          name: "Bachelor of Science in Computer Science",
        },
      ],
    };
    const fetchMock = respond(200, options);
    await expect(api.options("token")).resolves.toEqual(options);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/admin/fee-structures/options");
    expect(init.method).toBe("GET");
  });

  it("refuses options whose term flags are not booleans", async () => {
    respond(200, {
      terms: [{ id: termId, academicYear: "2026-2027", semester: "1", isCurrent: "yes" }],
      programs: [],
    });
    await expect(api.options("token")).rejects.toThrow();
  });

  it("names a term by year and semester", () => {
    expect(termLabel({ academicYear: "2026-2027", semester: "FIRST_SEMESTER" })).toBe(
      "2026-2027 First semester",
    );
    expect(termLabel({ academicYear: "2026-2027", semester: "Second Semester" })).toBe(
      "2026-2027 Second semester",
    );
    expect(termLabel({ academicYear: "2026-2027", semester: "SUMMER" })).toBe("2026-2027 Summer");
    expect(termLabel({ academicYear: "2026-2027", semester: "REGULAR" })).toBe("2026-2027 Regular");
  });

  it("AC-FIN-003.1: saves with PUT and the camel case body", async () => {
    const fetchMock = respond(200, structure);
    const input = { ...structure, academicTermId: undefined };
    await api.save("token", termId, input);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ ...structure, academicTermId: undefined });
  });

  it("refuses a response whose amount is not a decimal string", async () => {
    respond(200, { ...structure, labFee: 3500 });
    await expect(api.get("token", termId)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("AC-FIN-003.2: reads the field a VALIDATION_ERROR names", async () => {
    respond(422, {
      detail: "Rate or fee 'lab_fee' must not be negative.",
      code: "VALIDATION_ERROR",
      field: "lab_fee",
      details: { field: "lab_fee" },
    });
    const error = await api.save("token", termId, structure).catch((e: unknown) => e);
    expect(refusedFeeField(error)).toBe("labFee");
    expect(refusedFeeField(new ApiError(422, "VALIDATION_ERROR"))).toBeNull();
  });

  it("AC-FIN-003.5: reads the pair an INSTALLMENT_DATE_ORDER names", async () => {
    respond(422, {
      detail: "Installment due date 2026-02-01 is earlier than preceding due date 2026-03-01.",
      code: "INSTALLMENT_DATE_ORDER",
      details: { previousDate: "2026-03-01", currentDate: "2026-02-01" },
    });
    const error = await api.save("token", termId, structure).catch((e: unknown) => e);
    expect(refusedDatePair(error)).toEqual({ previous: "2026-03-01", current: "2026-02-01" });
  });

  it("AC-FIN-003.3 and .4: sums percentages exactly, without floating point", () => {
    expect(installmentTotal(["33.33", "33.33", "33.34"])).toBe(10000);
    expect(installmentTotal(["30", "30", "39.5"])).toBe(9950);
    expect(installmentTotal(["30", "30", "40.5"])).toBe(10050);
    expect(installmentTotal(["30", "abc"])).toBeNull();
    expect(installmentTotal([])).toBe(0);
    expect(formatHundredths(9950)).toBe("99.50");
    expect(formatHundredths(-50)).toBe("-0.50");
    expect(percentHundredths("1.234")).toBeNull();
  });

  it("AC-FIN-003.2: accepts only non-negative amounts with up to two decimals", () => {
    expect(isFeeAmount("1250")).toBe(true);
    expect(isFeeAmount("0.50")).toBe(true);
    expect(isFeeAmount("-1")).toBe(false);
    expect(isFeeAmount("1.005")).toBe(false);
    expect(isFeeAmount("")).toBe(false);
  });
});
