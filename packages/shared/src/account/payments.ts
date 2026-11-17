import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import * as parse from "../api/parse";
import {
  optionalAmount,
  PAYMENT_SETTLED,
  parseStudentAccount,
  type StudentAccount,
} from "./student";

// US-FIN-002: paying the balance online. Every amount is the API's decimal text; nothing here
// parses, adds, or compares one as a number (AC-FIN-002 and docs/CONVENTIONS.md).
//
// Contract assumptions, to confirm against the API's OpenAPI schema once it serves these routes:
//  - responses are camelCase, like GET /student/account;
//  - a payment's `status` is PENDING, SETTLED, or FAILED;
//  - the 409, 502, and 504 error envelopes carry the payment's `payment_id` (and, for a
//    failure, `reference`, `reason`, and `occurred_at`) in `details`.

/** The ways a student can pay. The labels are the page's. */
export const PAYMENT_METHODS = ["EWALLET", "BANK_TRANSFER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A payment the gateway has not answered yet: keep asking. */
export const PAYMENT_PENDING = "PENDING";
/** A payment the gateway refused: nothing was charged. */
export const PAYMENT_FAILED = "FAILED";

/** PAYMENT_SETTLED ("SETTLED") is the one with a receipt. */
export type PaymentStatus = typeof PAYMENT_PENDING | typeof PAYMENT_SETTLED | typeof PAYMENT_FAILED;

const STATUSES: readonly PaymentStatus[] = [PAYMENT_PENDING, PAYMENT_SETTLED, PAYMENT_FAILED];

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
  method: PaymentMethod;
}

/** One payment, from POST /student/payments or GET /student/payments/{payment_id}. */
export interface PaymentDetail {
  id: string;
  status: PaymentStatus;
  /** What the student quotes to the cashier. Null until the gateway assigns one. */
  reference: string | null;
  method: PaymentMethod | null;
  /** An instant, ISO 8601. */
  processedAt: string | null;
  /** What this payment settles, before fees. */
  amount: string | null;
  processingFee: string | null;
  lateFees: string | null;
  totalAmountPaid: string | null;
  /** What the student still owes once this payment posted. Only a settled payment has one. */
  newBalance: string | null;
  /** The gateway's own words for why it refused, such as "Insufficient Funds". */
  failureReason: string | null;
}

function parsePayment(body: unknown): PaymentDetail {
  const payment = parse.record(body);
  return {
    id: parse.string(payment.id),
    status: parse.oneOf(payment.status, STATUSES),
    reference: parse.optionalString(payment.reference),
    method:
      payment.method === undefined || payment.method === null
        ? null
        : parse.oneOf(payment.method, PAYMENT_METHODS),
    processedAt: parse.optionalString(payment.processedAt),
    amount: optionalAmount(payment.amount),
    processingFee: optionalAmount(payment.processingFee),
    lateFees: optionalAmount(payment.lateFees),
    totalAmountPaid: optionalAmount(payment.totalAmountPaid),
    newBalance: optionalAmount(payment.newBalance),
    failureReason: parse.optionalString(payment.failureReason),
  };
}

/** The student's payable account and the payment calls (US-FIN-002). */
export function createStudentPaymentsApi(client: ApiClient) {
  return {
    /** GET /student/account: the balance, the fees, and the total due. */
    async account(accessToken: string): Promise<StudentAccount> {
      const body = await client.request("/student/account", { method: "GET", accessToken });
      return parseStudentAccount(body);
    },

    /**
     * POST /student/payments. The `Idempotency-Key` is what makes a retry safe: the same key
     * for the same payment returns the same result instead of charging twice (AC-FIN-002.1).
     * No other call sends one.
     */
    async create(
      accessToken: string,
      request: PaymentRequest,
      idempotencyKey: string,
    ): Promise<PaymentDetail> {
      const body = await client.request("/student/payments", {
        method: "POST",
        accessToken,
        headers: { "Idempotency-Key": idempotencyKey },
        body: { amount: request.amount, method: request.method },
      });
      return parsePayment(body);
    },

    /** GET /student/payments/{payment_id}: where a payment stands now. */
    async get(accessToken: string, paymentId: string): Promise<PaymentDetail> {
      const body = await client.request(`/student/payments/${encodeURIComponent(paymentId)}`, {
        method: "GET",
        accessToken,
      });
      return parsePayment(body);
    },

    /** GET /student/payments/{payment_id}/receipt: the receipt file (AC-FIN-002.9). */
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
  /** 409: the first attempt is still being processed (AC-FIN-002.4). */
  | { kind: "in-progress"; paymentId: string | null; retryAfterMs: number | null }
  /** 502: the gateway refused. Nothing was charged. */
  | {
      kind: "gateway-error";
      paymentId: string | null;
      reference: string | null;
      reason: string | null;
      occurredAt: string | null;
    }
  /** 504: the gateway did not answer. The payment may still go through. */
  | { kind: "gateway-timeout"; paymentId: string | null; retryAfterMs: number | null }
  /** The request never got an answer: the same attempt, same key, may be sent again. */
  | { kind: "network" }
  | { kind: "other"; error: unknown };

function detailText(error: ApiError, ...names: string[]): string | null {
  for (const name of names) {
    const value = error.details?.[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function waitOf(error: ApiError): number | null {
  return error.retryAt === undefined ? null : Math.max(0, error.retryAt - Date.now());
}

/** Sort a rejection from the payment calls into what the page does about it. */
export function classifyPaymentError(error: unknown): PaymentFailureKind {
  if (!(error instanceof ApiError)) return { kind: "other", error };
  const paymentId = detailText(error, "payment_id", "paymentId");

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
    return { kind: "in-progress", paymentId, retryAfterMs: waitOf(error) };
  }
  if (error.status === 502 || error.code === PAYMENT_ERROR.gatewayError) {
    return {
      kind: "gateway-error",
      paymentId,
      reference: detailText(error, "reference"),
      reason: detailText(error, "reason", "gateway_reason") ?? error.detail ?? null,
      occurredAt: detailText(error, "occurred_at", "occurredAt"),
    };
  }
  if (error.status === 504 || error.code === PAYMENT_ERROR.gatewayTimeout) {
    return { kind: "gateway-timeout", paymentId, retryAfterMs: waitOf(error) };
  }
  return { kind: "other", error };
}
