import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { createStudentAccountApi } from "./student";

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

const account = {
  amountAssessed: "3000.00",
  subsidyApplied: null,
  netPayable: "3000.00",
  paymentStatus: "UNPAID",
  fheForfeited: false,
  fheForfeitureReason: null,
  lines: [{ code: "TUITION", description: "Tuition", amount: "3000.00", coveredBySubsidy: false }],
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
    expect(result.subsidyApplied).toBeNull();
    expect(result.overdueAmount).toBeNull();
    expect(result.lines).toEqual(account.lines);
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

  it("GET /student/payments reads the items", async () => {
    const fetch = reply({
      items: [
        {
          id: "p-1",
          paidAt: "2026-06-10T02:00:00Z",
          amount: "500.00",
          reference: "REF-1",
          status: "SETTLED",
          receiptUrl: "https://sis.example.test/r/1",
        },
        {
          id: "p-2",
          paidAt: "2026-06-11T02:00:00Z",
          amount: "100.00",
          reference: "REF-2",
          status: "PENDING",
        },
      ],
    });
    const api = createStudentAccountApi(createApiClient(root));

    const result = await api.payments("student-access");

    expect(fetch.mock.calls[0]?.[0]).toBe(root + "/student/payments");
    expect(result.map((payment) => payment.reference)).toEqual(["REF-1", "REF-2"]);
    expect(result[0]?.receiptUrl).toBe("https://sis.example.test/r/1");
    expect(result[1]?.receiptUrl).toBeNull();
  });
});
