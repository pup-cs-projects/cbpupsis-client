import type { PaymentCreated, PaymentDetail, StudentAccount } from "@cbpupsis/shared/account";
import { ApiError } from "@cbpupsis/shared/api";

import type { PaymentsClient } from "./usePayment";

// A stand-in for the payment API, so every state of the payment page can be seen in a browser
// without a gateway. It answers the same four calls as the live client and goes through the
// same page code: the Pay button, the lock, the replay, the polling, the screens. The one thing
// it skips is the trip to the gateway's page: the student "comes back" at once.
//
// It is on only in a dev build (never in tests or production), and only when:
//  - the address has ?preview=<scenario>, or apps/student/.env.local sets VITE_PAY_PREVIEW; or
//  - the API cannot be reached, or does not know the route yet (see previewFallback).
// The preview bar on the page then switches scenario. To go back to the live API, remove the
// ?preview and the VITE_PAY_PREVIEW line, and nothing else: PayPage already calls the live client.

/** What happens when the student presses Pay. */
export const PREVIEW_SCENARIOS = [
  { id: "success", label: "Succeeds" },
  { id: "failed", label: "Fails (502)" },
  { id: "in-progress", label: "In progress (409)" },
  { id: "timeout", label: "Times out (504)" },
  { id: "amount-exceeds", label: "Amount too high (422)" },
] as const;

export type PreviewScenario = (typeof PREVIEW_SCENARIOS)[number]["id"];

function isScenario(value: unknown): value is PreviewScenario {
  return PREVIEW_SCENARIOS.some((scenario) => scenario.id === value);
}

/** True only in `npm run dev:student`; tests meet the mocked API, as the billing sample does. */
export function previewAllowed(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE !== "test";
}

/** The scenario the developer asked for in the address or the environment, or null. */
export function initialPreview(): PreviewScenario | null {
  if (!previewAllowed()) return null;
  const fromAddress = new URLSearchParams(window.location.search).get("preview");
  const fromEnvironment = import.meta.env.VITE_PAY_PREVIEW as string | undefined;
  for (const value of [fromAddress, fromEnvironment]) {
    if (isScenario(value)) return value;
  }
  return null;
}

/** The API did not answer, or has no such route yet: the cases a preview stands in for. */
export function previewFallback(error: unknown): boolean {
  return (
    previewAllowed() &&
    error instanceof ApiError &&
    (error.status === 0 || error.status === 404 || error.status === 501)
  );
}

// Sample figures are fixed text, as the API would send them.
const ACCOUNT: StudentAccount = {
  amountAssessed: "2145.00",
  subsidyApplied: "0.00",
  netPayable: "2145.00",
  paymentStatus: "OVERDUE",
  fheQualified: false,
  fheForfeited: false,
  fheForfeitureReason: null,
  lines: [
    { description: "Tuition", amount: "2045.00", coveredByFhe: false },
    { description: "Late payment fine", amount: "100.00", coveredByFhe: false },
  ],
  overdueAmount: "2145.00",
  penaltyAmount: "100.00",
};

const PAID: PaymentDetail = {
  id: "preview-paid",
  state: "PAID",
  amount: "2145.00",
  currency: "PHP",
  reference: "xnd-pay-8f3a1c",
  receiptNumber: "RCPT-2026-004521",
  paidAt: "2026-11-18T06:42:00Z",
  createdAt: "2026-11-18T06:40:00Z",
};

const PENDING: PaymentDetail = {
  ...PAID,
  id: "preview-pending",
  state: "PENDING",
  reference: null,
  receiptNumber: null,
  paidAt: null,
};

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The preview API for one scenario. */
export function previewPaymentsClient(scenario: PreviewScenario): PaymentsClient {
  let calls = 0;
  const created = (id: string): PaymentCreated => ({
    paymentId: id,
    state: "PENDING",
    checkoutUrl: "https://checkout.example.test/preview",
  });

  return {
    async account() {
      await pause(300);
      return ACCOUNT;
    },

    async create() {
      // Long enough to see the locked, "Processing" button.
      await pause(900);
      calls += 1;
      switch (scenario) {
        case "success":
          return created(PAID.id);
        case "failed":
          throw new ApiError(502, "PAYMENT_GATEWAY_ERROR", {
            detail: "The payment gateway rejected the request.",
            reason: "Insufficient Funds",
          });
        case "in-progress":
          // The first call is "still being created"; asking again with the same key answers.
          if (calls === 1) {
            throw new ApiError(409, "PAYMENT_IN_PROGRESS", { retryAt: Date.now() + 4_000 });
          }
          return created(PAID.id);
        case "timeout":
          throw new ApiError(504, "PAYMENT_GATEWAY_TIMEOUT");
        case "amount-exceeds":
          throw new ApiError(422, "AMOUNT_EXCEEDS_BALANCE", {
            detail: "The payment amount exceeds the available balance.",
          });
      }
    },

    async get(paymentId) {
      await pause(300);
      return paymentId === PAID.id ? PAID : PENDING;
    },

    async receipt() {
      await pause(300);
      return new Blob(["Preview receipt. No real payment was made."], { type: "application/pdf" });
    },
  };
}
