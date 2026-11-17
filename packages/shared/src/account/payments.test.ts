import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { classifyPaymentError, createStudentPaymentsApi } from "./payments";

const root = "http://localhost:8000/api/v1";

function reply(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const fetch = vi.fn(
    async (_input: string, _init?: RequestInit) =>
      new Response(body === undefined ? null : JSON.stringify(body), { status, headers }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function headersOf(fetch: ReturnType<typeof reply>) {
  return new Headers(fetch.mock.calls[0][1]?.headers);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const settled = {
  id: "pay-1",
  status: "SETTLED",
  reference: "PUP-1",
  method: "EWALLET",
  processedAt: "2026-11-17T06:42:00Z",
  amount: "1500.00",
  processingFee: "15.00",
  lateFees: "0.00",
  totalAmountPaid: "1515.00",
  newBalance: "545.00",
  failureReason: null,
};

describe("student payments API boundary", () => {
  const api = createStudentPaymentsApi(createApiClient(root));

  it("AC-FIN-002.1: POST /student/payments sends the Idempotency-Key, the token, and the amount as text", async () => {
    const fetch = reply({ id: "pay-1", status: "PENDING" }, 201);

    const result = await api.create(
      "access",
      { amount: "1500.00", method: "BANK_TRANSFER" },
      "key-123",
    );

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${root}/student/payments`);
    expect(init?.method).toBe("POST");
    expect(headersOf(fetch).get("Idempotency-Key")).toBe("key-123");
    expect(headersOf(fetch).get("Authorization")).toBe("Bearer access");
    expect(headersOf(fetch).get("Content-Type")).toBe("application/json");
    expect(init?.body).toBe(JSON.stringify({ amount: "1500.00", method: "BANK_TRANSFER" }));
    expect(result).toMatchObject({ id: "pay-1", status: "PENDING", reference: null });
  });

  it("AC-FIN-002.1: no read sends an Idempotency-Key", async () => {
    for (const call of [
      () => api.account("access"),
      () => api.get("access", "pay-1"),
      () => api.receipt("access", "pay-1"),
    ]) {
      const fetch = reply(
        {
          amountAssessed: "1.00",
          netPayable: "1.00",
          paymentStatus: "UNPAID",
          fheForfeited: false,
          lines: [],
          ...settled,
        },
        200,
      );
      await call();
      expect(headersOf(fetch).has("Idempotency-Key")).toBe(false);
    }
  });

  it("GET /student/account reads the processing fee and the total due as text", async () => {
    reply({
      amountAssessed: "3000.00",
      subsidyApplied: null,
      netPayable: "2045.00",
      paymentStatus: "OVERDUE",
      fheForfeited: false,
      fheForfeitureReason: null,
      overdueAmount: "2045.00",
      penaltyAmount: "204.50",
      processingFee: "15.00",
      totalAmountDue: "9007199254740993.10",
      lines: [],
    });

    const result = await api.account("access");

    expect(result.processingFee).toBe("15.00");
    expect(result.totalAmountDue).toBe("9007199254740993.10");
  });

  it("GET /student/payments/{payment_id} keeps every amount as the text the API sent", async () => {
    const fetch = reply({ ...settled, totalAmountPaid: "9007199254740993.10" });

    const result = await api.get("access", "pay/1");

    expect(fetch.mock.calls[0][0]).toBe(`${root}/student/payments/pay%2F1`);
    expect(result.totalAmountPaid).toBe("9007199254740993.10");
    expect(result).toMatchObject({ status: "SETTLED", newBalance: "545.00", method: "EWALLET" });
  });

  it("rejects a payment with an unknown status instead of guessing", async () => {
    reply({ ...settled, status: "REFUNDED" });

    await expect(api.get("access", "pay-1")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("AC-FIN-002.9: GET /student/payments/{payment_id}/receipt returns the file", async () => {
    const fetch = vi.fn(async (_input: string) => new Response("%PDF-receipt", { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    const file = await api.receipt("access", "pay-1");

    expect(fetch.mock.calls[0][0]).toBe(`${root}/student/payments/pay-1/receipt`);
    expect(await file.text()).toBe("%PDF-receipt");
  });
});

describe("classifyPaymentError", () => {
  it("422 AMOUNT_EXCEEDS_BALANCE is the API's sentence for the amount field", () => {
    const error = new ApiError(422, "AMOUNT_EXCEEDS_BALANCE", { detail: "Too much." });

    expect(classifyPaymentError(error)).toEqual({ kind: "validation", message: "Too much." });
  });

  it("422 with no sentence still gets words", () => {
    expect(classifyPaymentError(new ApiError(422, "AMOUNT_EXCEEDS_BALANCE"))).toMatchObject({
      kind: "validation",
      message: "This amount is more than your outstanding balance.",
    });
    expect(classifyPaymentError(new ApiError(422, undefined))).toMatchObject({
      message: "Enter a valid amount.",
    });
  });

  it("AC-FIN-002.4: 409 PAYMENT_IN_PROGRESS carries the payment and the Retry-After wait", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const error = new ApiError(409, "PAYMENT_IN_PROGRESS", {
      retryAt: 1_000_000 + 3_000,
      details: { payment_id: "pay-1" },
    });

    expect(classifyPaymentError(error)).toEqual({
      kind: "in-progress",
      paymentId: "pay-1",
      retryAfterMs: 3_000,
    });
  });

  it("502 is a failure with the gateway's reason, falling back to the API's sentence", () => {
    expect(
      classifyPaymentError(
        new ApiError(502, "PAYMENT_GATEWAY_ERROR", {
          detail: "Gateway error.",
          details: { reason: "Insufficient Funds", reference: "R-1", occurred_at: "2026-11-17" },
        }),
      ),
    ).toEqual({
      kind: "gateway-error",
      paymentId: null,
      reference: "R-1",
      reason: "Insufficient Funds",
      occurredAt: "2026-11-17",
    });
    expect(
      classifyPaymentError(new ApiError(502, "PAYMENT_GATEWAY_ERROR", { detail: "Declined." })),
    ).toMatchObject({ reason: "Declined." });
  });

  it("504 is a timeout, and a dropped connection is a network error to retry as it was", () => {
    expect(classifyPaymentError(new ApiError(504, "PAYMENT_GATEWAY_TIMEOUT"))).toMatchObject({
      kind: "gateway-timeout",
      paymentId: null,
    });
    expect(classifyPaymentError(new ApiError(0, "NETWORK_ERROR"))).toEqual({ kind: "network" });
  });

  it("anything else is left for the page's generic message", () => {
    expect(classifyPaymentError(new ApiError(500, undefined))).toMatchObject({ kind: "other" });
    expect(classifyPaymentError(new Error("boom"))).toMatchObject({ kind: "other" });
  });
});
