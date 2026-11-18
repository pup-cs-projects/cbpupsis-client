import type { PaymentDetail, StudentAccount } from "@cbpupsis/shared/account";
import { ApiError } from "@cbpupsis/shared/api";

import type { PaymentsClient } from "./usePayment";

// A stand-in for the payment API, so every state of the payment page can be seen in a browser
// before the API serves /student/payments. It answers the same four calls as the live client
// and goes through the same page code: the Pay button, the lock, the polling, the screens.
//
// It is on only in a dev build (never in tests or production), and only when:
//  - the address has ?preview=<scenario>, or apps/student/.env.local sets VITE_PAY_PREVIEW; or
//  - the API cannot be reached, or does not know the route yet (see previewFallback).
// The preview bar on the page then switches scenario. To go back to the live API, remove the
// ?preview, the VITE_PAY_PREVIEW line, and nothing else: PayPage already calls the live client.

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
  amountAssessed: "2190.00",
  subsidyApplied: "145.00",
  netPayable: "2045.00",
  paymentStatus: "OVERDUE",
  fheForfeited: false,
  fheForfeitureReason: null,
  overdueAmount: "2045.00",
  penaltyAmount: "204.50",
  processingFee: "15.00",
  totalAmountDue: "2264.50",
  lines: [],
};

const SETTLED: PaymentDetail = {
  id: "preview-settled",
  status: "SETTLED",
  reference: "PUP-2026-004521",
  method: "EWALLET",
  processedAt: "2026-11-17T06:42:00Z",
  amount: "2045.00",
  processingFee: "15.00",
  lateFees: "204.50",
  totalAmountPaid: "2264.50",
  newBalance: "0.00",
  failureReason: null,
};

const PENDING: PaymentDetail = {
  ...SETTLED,
  id: "preview-pending",
  status: "PENDING",
  reference: null,
  processedAt: null,
  newBalance: null,
};

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The preview API for one scenario. */
export function previewPaymentsClient(scenario: PreviewScenario): PaymentsClient {
  return {
    async account() {
      await pause(300);
      return ACCOUNT;
    },

    async create() {
      // Long enough to see the locked, "Processing" button.
      await pause(900);
      switch (scenario) {
        case "success":
          return { ...PENDING, id: SETTLED.id };
        case "failed":
          throw new ApiError(502, "PAYMENT_GATEWAY_ERROR", {
            detail: "Insufficient Funds",
            details: {
              reference: "PUP-2026-004522",
              reason: "Insufficient Funds",
              occurred_at: "2026-11-17T06:42:00Z",
            },
          });
        case "in-progress":
          throw new ApiError(409, "PAYMENT_IN_PROGRESS", {
            retryAt: Date.now() + 3_000,
            details: { payment_id: PENDING.id },
          });
        case "timeout":
          throw new ApiError(504, "PAYMENT_GATEWAY_TIMEOUT", {
            details: { payment_id: PENDING.id },
          });
        case "amount-exceeds":
          throw new ApiError(422, "AMOUNT_EXCEEDS_BALANCE", {
            detail: "The amount is more than your outstanding balance.",
          });
      }
    },

    async get(paymentId) {
      await pause(300);
      return paymentId === SETTLED.id ? SETTLED : PENDING;
    },

    async receipt() {
      await pause(300);
      return new Blob(["Preview receipt. No real payment was made."], { type: "text/plain" });
    },
  };
}
