import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { createStudentAccountApi, isSettled } from "./student";

const root = "http://localhost:8000/api/v1";

function reply(body: unknown, responseStatus = 200) {
  const fetch = vi.fn(
    async (_input: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: responseStatus,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// What GET /api/v1/student/account returns (AccountRead in cbpupsis-api).
const account = {
  amountAssessed: "3000.00",
  subsidyApplied: "0.00",
  netPayable: "3000.00",
  paymentStatus: "DUE",
  holds: [],
  lines: [{ description: "Tuition", amount: "3000.00", coveredByFhe: false }],
  fheQualified: true,
  fheForfeited: false,
  fheForfeitureReason: null,
};

describe("student account API boundary", () => {
  it("GET /student/account keeps every amount as the text the API sent", async () => {
    const fetch = reply({ ...account, amountAssessed: "9007199254740993.10" });
    const api = createStudentAccountApi(createApiClient(root));

    const result = await api.account("student-access");

    expect(fetch.mock.calls[0]?.[0]).toBe(root + "/student/account");
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(
      "Bearer student-access",
    );
    expect(result.amountAssessed).toBe("9007199254740993.10");
    expect(result.netPayable).toBe("3000.00");
    expect(result.subsidyApplied).toBe("0.00");
    expect(result.lines).toEqual(account.lines);
    expect(result.paymentStatus).toBe("DUE");
    expect(result.overdueAmount).toBeNull();
    expect(result.penaltyAmount).toBeNull();
  });

  it("an OVERDUE account's overdue amount is netPayable and its penalty is the fine line, as sent", async () => {
    reply({
      ...account,
      paymentStatus: "OVERDUE",
      netPayable: "3100.00",
      amountAssessed: "3100.00",
      lines: [
        ...account.lines,
        { description: "Late payment fine", amount: "100.00", coveredByFhe: false },
      ],
    });
    const api = createStudentAccountApi(createApiClient(root));

    const result = await api.account("t");

    expect(result.overdueAmount).toBe("3100.00");
    expect(result.penaltyAmount).toBe("100.00");
  });

  it("an OVERDUE account with no fine line has no penalty", async () => {
    reply({ ...account, paymentStatus: "OVERDUE" });
    const api = createStudentAccountApi(createApiClient(root));

    const result = await api.account("t");

    expect(result.overdueAmount).toBe("3000.00");
    expect(result.penaltyAmount).toBeNull();
  });

  it("reads a JSON number amount back as its text", async () => {
    reply({ ...account, netPayable: 2045.5 });
    const api = createStudentAccountApi(createApiClient(root));

    expect((await api.account("t")).netPayable).toBe("2045.5");
  });

  it("rejects an amount that is not a decimal as INVALID_RESPONSE", async () => {
    reply({ ...account, netPayable: "lots" });
    const api = createStudentAccountApi(createApiClient(root));

    await expect(api.account("t")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("rejects a payment status the API does not define as INVALID_RESPONSE", async () => {
    reply({ ...account, paymentStatus: "UNPAID" });
    const api = createStudentAccountApi(createApiClient(root));

    await expect(api.account("t")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("GET /student/payments reads the bare array, keyed by reference", async () => {
    const fetch = reply([
      { date: "2026-06-10T02:00:00Z", amount: "500.00", reference: "REF-1", status: "PAID" },
      { date: "2026-06-09T02:00:00Z", amount: "100.00", reference: "REF-2", status: "PENDING" },
    ]);
    const api = createStudentAccountApi(createApiClient(root));

    const result = await api.payments("student-access");

    expect(fetch.mock.calls[0]?.[0]).toBe(root + "/student/payments");
    expect(result).toEqual([
      {
        id: "REF-1",
        paidAt: "2026-06-10T02:00:00Z",
        amount: "500.00",
        reference: "REF-1",
        status: "PAID",
        paymentId: null,
        receiptUrl: null,
      },
      {
        id: "REF-2",
        paidAt: "2026-06-09T02:00:00Z",
        amount: "100.00",
        reference: "REF-2",
        status: "PENDING",
        paymentId: null,
        receiptUrl: null,
      },
    ]);
  });

  it("reads the payment's UUID from paymentId or id when the API sends one, so its receipt can be fetched", async () => {
    const ID = "2b9d4a3e-6f1c-4a8e-9a57-3f0c8e1d7b11";
    const OTHER = "9c1e7b52-0d4a-4c3f-8b6e-1a2f3d4e5f60";
    reply([
      {
        date: "2026-06-10T02:00:00Z",
        amount: "1.00",
        reference: "A",
        status: "PAID",
        paymentId: ID,
      },
      { date: "2026-06-09T02:00:00Z", amount: "1.00", reference: "B", status: "PAID", id: OTHER },
    ]);
    const api = createStudentAccountApi(createApiClient(root));

    const result = await api.payments("t");

    expect(result.map((payment) => payment.paymentId)).toEqual([ID, OTHER]);
  });

  it("never keeps a payment id that is not a UUID: the reference is not one", async () => {
    reply([
      { date: "2026-06-10T02:00:00Z", amount: "1.00", reference: "xnd-pay-1", status: "PAID" },
      {
        date: "2026-06-09T02:00:00Z",
        amount: "1.00",
        reference: "cbp-123",
        status: "PAID",
        paymentId: "../../account",
        id: 42,
      },
    ]);
    const api = createStudentAccountApi(createApiClient(root));

    const result = await api.payments("t");

    expect(result.map((payment) => payment.paymentId)).toEqual([null, null]);
  });

  it("an empty payment history is an empty array", async () => {
    reply([]);
    const api = createStudentAccountApi(createApiClient(root));

    expect(await api.payments("t")).toEqual([]);
  });

  it("isSettled is true for a PAID payment only", () => {
    expect(isSettled({ status: "PAID" })).toBe(true);
    expect(isSettled({ status: "paid" })).toBe(true);
    expect(isSettled({ status: "PENDING" })).toBe(false);
  });
});
