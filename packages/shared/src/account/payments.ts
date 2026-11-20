import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import * as parse from "../api/parse";
import { amount, parseStudentAccount, type StudentAccount } from "./student";

// US-FIN-002: paying the balance online, against cbpupsis-api#85 (docs/openapi.json on fr006).
// Every amount is the API's decimal text; nothing here parses, adds, or compares one as a number.
//
// How the real flow works, which is not a card form:
//  1. POST /student/payments { amount } with an Idempotency-Key creates ONE hosted Xendit
//     checkout and answers 201 { paymentId, state: "PENDING", checkoutUrl }. The student pays
//     on Xendit's page, so the API takes no payment method and no card data.
//  2. Xendit returns the student to the portal (the API's XENDIT_SUCCESS_RETURN_URL and
//     XENDIT_CANCEL_RETURN_URL, /payments/success and /payments/cancel). Those addresses name no
//     payment. The webhook, not the browser, settles the payment.
//  3. GET /student/payments/{paymentId} says where it stands: PENDING, PAID, or FAILED. It has
//     no balance: what the student owes now is GET /student/account again.
//  4. GET /student/payments/{paymentId}/receipt is a PDF, only once the payment is PAID.
// The same Idempotency-Key replays the stored answer of the first call, whatever it was.

/** A payment still waiting for the gateway: keep asking. */
export const PAYMENT_PENDING = "PENDING";
/** A payment the gateway settled: the only one with a receipt. */
export const PAYMENT_PAID = "PAID";
/** A payment the gateway refused or let expire: nothing was charged. */
export const PAYMENT_FAILED = "FAILED";

export type PaymentState = typeof PAYMENT_PENDING | typeof PAYMENT_PAID | typeof PAYMENT_FAILED;

const STATES: readonly PaymentState[] = [PAYMENT_PENDING, PAYMENT_PAID, PAYMENT_FAILED];

/** The `code`s of the payment refusals the page tells apart. */
export const PAYMENT_ERROR = {
  amountExceedsBalance: "AMOUNT_EXCEEDS_BALANCE",
  inProgress: "PAYMENT_IN_PROGRESS",
  gatewayError: "PAYMENT_GATEWAY_ERROR",
  gatewayTimeout: "PAYMENT_GATEWAY_TIMEOUT",
} as const;

/** POST /student/payments. `amount` is pesos as text: "1500.00", never a number. */
export interface PaymentRequest {
  amount: string;
}

/** 201 from POST /student/payments: the student goes on to `checkoutUrl` to pay. */
export interface PaymentCreated {
  paymentId: string;
  state: PaymentState;
  /** An https address on the gateway. */
  checkoutUrl: string;
}

/** GET /student/payments/{payment_id}. */
export interface PaymentDetail {
  id: string;
  state: PaymentState;
  /** What this payment is for, two places: "1500.00". */
  amount: string;
  currency: string;
  /** The gateway's reference. Null until the gateway has one. */
  reference: string | null;
  /** The receipt number. Only a PAID payment has one. */
  receiptNumber: string | null;
  /** An instant, ISO 8601. Null until PAID. */
  paidAt: string | null;
  /** An instant, ISO 8601. */
  createdAt: string;
}

/** Only a gateway address over https is somewhere to send a student to pay. */
function checkoutUrl(value: unknown): string {
  const text = parse.string(value);
  try {
    return new URL(text).protocol === "https:" ? text : parse.invalid();
  } catch {
    return parse.invalid();
  }
}

function parseCreated(body: unknown): PaymentCreated {
  const created = parse.record(body);
  return {
    paymentId: parse.string(created.paymentId),
    state: parse.oneOf(created.state, STATES),
    checkoutUrl: checkoutUrl(created.checkoutUrl),
  };
}

function parsePayment(body: unknown): PaymentDetail {
  const payment = parse.record(body);
  return {
    id: parse.string(payment.paymentId),
    state: parse.oneOf(payment.state, STATES),
    amount: amount(payment.amount),
    currency: parse.optionalString(payment.currency) ?? "PHP",
    reference: parse.optionalString(payment.gatewayReference),
    receiptNumber: parse.optionalString(payment.receiptNumber),
    paidAt: parse.optionalString(payment.paidAt),
    createdAt: parse.string(payment.createdAt),
  };
}

/** The student's payable account and the payment calls (US-FIN-002). */
export function createStudentPaymentsApi(client: ApiClient) {
  return {
    /** GET /student/account: the balance to pay. */
    async account(accessToken: string): Promise<StudentAccount> {
      const body = await client.request("/student/account", { method: "GET", accessToken });
      return parseStudentAccount(body);
    },

    /**
     * POST /student/payments. The `Idempotency-Key` is what makes a retry safe: the same key
     * for the same student returns the first call's answer instead of creating a second
     * checkout (AC-FIN-002.1). No other call sends one.
     *
     * Refusals arrive as ApiError: 400 IDEMPOTENCY_KEY_REQUIRED, 409 PAYMENT_IN_PROGRESS (with
     * Retry-After), 422 AMOUNT_EXCEEDS_BALANCE, 502 PAYMENT_GATEWAY_ERROR (with `reason`), and
     * 504 PAYMENT_GATEWAY_TIMEOUT. See `classifyPaymentError`.
     */
    async create(
      accessToken: string,
      request: PaymentRequest,
      idempotencyKey: string,
    ): Promise<PaymentCreated> {
      const body = await client.request("/student/payments", {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        // The API forbids any other field, so nothing but the amount goes.
        body: { amount: request.amount },
      });
      return parseCreated(body);
    },

    /** GET /student/payments/{payment_id}: where a payment stands now. 404 if it is not theirs. */
    async get(accessToken: string, paymentId: string): Promise<PaymentDetail> {
      const body = await client.request(`/student/payments/${encodeURIComponent(paymentId)}`, {
        method: "GET",
        accessToken,
      });
      return parsePayment(body);
    },

    /** GET /student/payments/{payment_id}/receipt: the PDF. 409 until the payment is PAID. */
    receipt(accessToken: string, paymentId: string): Promise<Blob> {
      return client.requestBlob(`/student/payments/${encodeURIComponent(paymentId)}/receipt`, {
        accessToken,
      });
    },
  };
}

export type StudentPaymentsApi = ReturnType<typeof createStudentPaymentsApi>;

/** What a rejected payment call means for the page. */
export type PaymentFailureKind =
  /** 422: the amount is refused. `message` belongs on the amount field. */
  | { kind: "validation"; message: string }
  /**
   * 409: the first attempt with this key is still being created (AC-FIN-002.4). The answer
   * names no payment, so the page asks again with the same key after `retryAfterMs`.
   */
  | { kind: "in-progress"; retryAfterMs: number | null }
  /** 502: the gateway refused. Nothing was charged. `reason` is the gateway's own words. */
  | { kind: "gateway-error"; reason: string | null }
  /** 504: the gateway did not answer. The attempt stays pending; do not pay again. */
  | { kind: "gateway-timeout" }
  /** The request never got an answer: the same attempt, same key, may be sent again. */
  | { kind: "network" }
  | { kind: "other"; error: unknown };

function waitOf(error: ApiError): number | null {
  return error.retryAt === undefined ? null : Math.max(0, error.retryAt - Date.now());
}

/** Sort a rejection from the payment calls into what the page does about it. */
export function classifyPaymentError(error: unknown): PaymentFailureKind {
  if (!(error instanceof ApiError)) return { kind: "other", error };

  if (error.status === 0 && error.code === "NETWORK_ERROR") return { kind: "network" };
  if (error.status === 422) {
    return {
      kind: "validation",
      message:
        error.detail ??
        (error.code === PAYMENT_ERROR.amountExceedsBalance
          ? "This amount is more than your outstanding balance."
          : "Enter a valid amount."),
    };
  }
  if (error.status === 409 && error.code === PAYMENT_ERROR.inProgress) {
    return { kind: "in-progress", retryAfterMs: waitOf(error) };
  }
  if (error.status === 502 || error.code === PAYMENT_ERROR.gatewayError) {
    return { kind: "gateway-error", reason: error.reason ?? error.detail ?? null };
  }
  if (error.status === 504 || error.code === PAYMENT_ERROR.gatewayTimeout) {
    return { kind: "gateway-timeout" };
  }
  return { kind: "other", error };
}
