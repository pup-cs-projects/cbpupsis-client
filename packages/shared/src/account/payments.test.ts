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

const ID = "2b9d4a3e-6f1c-4a8e-9a57-3f0c8e1d7b11";

/** What GET /student/payments/{payment_id} sends, as cbpupsis-api's PaymentDetailRead. */
const paid = {
  paymentId: ID,
  state: "PAID",
  amount: "1500.00",
  currency: "PHP",
  gatewayReference: "xnd-pay-1",
  receiptNumber: "RCPT-1",
  paidAt: "2026-11-18T06:42:00Z",
  createdAt: "2026-11-18T06:40:00Z",
};

describe("student payments API boundary (cbpupsis-api#85)", () => {
  const api = createStudentPaymentsApi(createApiClient(root));

  it("AC-FIN-002.1: POST /student/payments sends the Idempotency-Key, the token, and only the amount", async () => {
    const fetch = reply(
      { paymentId: ID, state: "PENDING", checkoutUrl: "https://checkout.xendit.co/web/abc" },
      201,
    );

    const result = await api.create("access", { amount: "1500.00" }, "key-123");

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${root}/student/payments`);
    expect(init?.method).toBe("POST");
    expect(headersOf(fetch).get("Idempotency-Key")).toBe("key-123");
    expect(headersOf(fetch).get("Authorization")).toBe("Bearer access");
    expect(headersOf(fetch).get("Content-Type")).toBe("application/json");
    // The API forbids any other field, so the amount, as text, is all that is sent.
    expect(init?.body).toBe(JSON.stringify({ amount: "1500.00" }));
    expect(result).toEqual({
      paymentId: ID,
      state: "PENDING",
      checkoutUrl: "https://checkout.xendit.co/web/abc",
    });
  });

  it("reads a checkout that is already PAID or FAILED, for a response that is terminal at once", async () => {
    for (const state of ["PAID", "FAILED"]) {
      reply({ paymentId: ID, state, checkoutUrl: "https://checkout.xendit.co/web/abc" }, 201);

      expect(await api.create("access", { amount: "1.00" }, "k")).toMatchObject({ state });
    }
  });

  it("sends the student nowhere but an https gateway address", async () => {
    for (const checkoutUrl of ["http://checkout.xendit.co/x", "javascript:alert(1)", "not a url"]) {
      reply({ paymentId: ID, state: "PENDING", checkoutUrl }, 201);

      await expect(api.create("access", { amount: "1.00" }, "k")).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
      });
    }
  });

  it("AC-FIN-002.1: no read sends an Idempotency-Key", async () => {
    for (const call of [
      () => api.account("access"),
      () => api.get("access", ID),
      () => api.receipt("access", ID),
    ]) {
      const fetch = reply({
        amountAssessed: "1.00",
        subsidyApplied: "0.00",
        netPayable: "1.00",
        paymentStatus: "DUE",
        fheQualified: true,
        fheForfeited: false,
        fheForfeitureReason: null,
        lines: [],
        ...paid,
      });
      await call();
      expect(headersOf(fetch).has("Idempotency-Key")).toBe(false);
    }
  });

  it("GET /student/account reads the live account shape", async () => {
    reply({
      amountAssessed: "2145.00",
      subsidyApplied: "0.00",
      netPayable: "2145.00",
      paymentStatus: "OVERDUE",
      holds: [],
      lines: [
        { description: "Tuition", amount: "2045.00", coveredByFhe: false },
        { description: "Late payment fine", amount: "100.00", coveredByFhe: false },
      ],
      fheQualified: false,
      fheForfeited: false,
      fheForfeitureReason: null,
    });

    const result = await api.account("access");

    expect(result).toMatchObject({
      netPayable: "2145.00",
      paymentStatus: "OVERDUE",
      overdueAmount: "2145.00",
      penaltyAmount: "100.00",
    });
    expect(result.lines[0]).toEqual({
      description: "Tuition",
      amount: "2045.00",
      coveredByFhe: false,
    });
  });

  it("GET /student/payments/{payment_id} reads the status, reference, and receipt number as text", async () => {
    const fetch = reply({ ...paid, amount: "9007199254740993.10" });

    const result = await api.get("access", ID);

    expect(fetch.mock.calls[0][0]).toBe(`${root}/student/payments/${ID}`);
    expect(result).toEqual({
      id: ID,
      state: "PAID",
      amount: "9007199254740993.10",
      currency: "PHP",
      reference: "xnd-pay-1",
      receiptNumber: "RCPT-1",
      paidAt: "2026-11-18T06:42:00Z",
      createdAt: "2026-11-18T06:40:00Z",
    });
  });

  it("reads a PENDING payment, which has no reference, receipt number, or paid date yet", async () => {
    reply({
      ...paid,
      state: "PENDING",
      gatewayReference: null,
      receiptNumber: null,
      paidAt: null,
    });

    expect(await api.get("access", ID)).toMatchObject({
      state: "PENDING",
      reference: null,
      receiptNumber: null,
      paidAt: null,
    });
  });

  it("rejects a payment in a state it does not know instead of guessing", async () => {
    reply({ ...paid, state: "REFUNDED" });

    await expect(api.get("access", ID)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("AC-FIN-002.9: GET /student/payments/{payment_id}/receipt returns the PDF", async () => {
    const fetch = vi.fn(
      async (_input: string) =>
        new Response("%PDF-receipt", {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        }),
    );
    vi.stubGlobal("fetch", fetch);

    const file = await api.receipt("access", ID);

    expect(fetch.mock.calls[0][0]).toBe(`${root}/student/payments/${ID}/receipt`);
    expect(await file.text()).toBe("%PDF-receipt");
  });
});

describe("classifyPaymentError", () => {
  it("422 AMOUNT_EXCEEDS_BALANCE is the API's sentence for the amount field", () => {
    const error = new ApiError(422, "AMOUNT_EXCEEDS_BALANCE", {
      detail: "The payment amount exceeds the available balance.",
    });

    expect(classifyPaymentError(error)).toEqual({
      kind: "validation",
      message: "The payment amount exceeds the available balance.",
    });
  });

  it("422 with no sentence (FastAPI's field errors) still gets words", () => {
    expect(classifyPaymentError(new ApiError(422, "AMOUNT_EXCEEDS_BALANCE"))).toMatchObject({
      kind: "validation",
      message: "This amount is more than your outstanding balance.",
    });
    expect(classifyPaymentError(new ApiError(422, undefined))).toMatchObject({
      message: "Enter a valid amount.",
    });
  });

  it("AC-FIN-002.4: 409 PAYMENT_IN_PROGRESS carries the Retry-After wait", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const error = new ApiError(409, "PAYMENT_IN_PROGRESS", { retryAt: 1_000_000 + 2_000 });

    expect(classifyPaymentError(error)).toEqual({ kind: "in-progress", retryAfterMs: 2_000 });
  });

  it("a 409 for anything else, such as an unsettled receipt, is not 'in progress'", () => {
    expect(classifyPaymentError(new ApiError(409, "CONFLICT"))).toMatchObject({ kind: "other" });
  });

  it("AC-FIN-002.10: 502 is a failure with the gateway's own reason, falling back to the sentence", () => {
    expect(
      classifyPaymentError(
        new ApiError(502, "PAYMENT_GATEWAY_ERROR", {
          detail: "The payment gateway rejected the request.",
          reason: "Insufficient Funds",
        }),
      ),
    ).toEqual({ kind: "gateway-error", reason: "Insufficient Funds" });
    expect(
      classifyPaymentError(new ApiError(502, "PAYMENT_GATEWAY_ERROR", { detail: "Declined." })),
    ).toEqual({ kind: "gateway-error", reason: "Declined." });
  });

  it("504 is a timeout, and a dropped connection is a network error to retry as it was", () => {
    expect(classifyPaymentError(new ApiError(504, "PAYMENT_GATEWAY_TIMEOUT"))).toEqual({
      kind: "gateway-timeout",
    });
    expect(classifyPaymentError(new ApiError(0, "NETWORK_ERROR"))).toEqual({ kind: "network" });
  });

  it("anything else is left for the page's generic message", () => {
    expect(classifyPaymentError(new ApiError(500, undefined))).toMatchObject({ kind: "other" });
    expect(classifyPaymentError(new Error("boom"))).toMatchObject({ kind: "other" });
  });
});
