import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

/** The account's `paymentStatus` when the due date has passed and a balance remains. */
export const PAYMENT_OVERDUE = "OVERDUE";

/** The description of the fixed late fine line the API adds once a term account is overdue. */
export const LATE_FINE_DESCRIPTION = "Late payment fine";

const PAYMENT_STATUSES = ["PAID", "PARTIAL", "DUE", "OVERDUE"] as const;
export type AccountPaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** One fee on the current term's assessment. */
export interface AccountLine {
  /** What the student reads: "Tuition", "Late payment fine", ... */
  description: string;
  /** Pesos, as the API sends them: "3000.00". Never parsed into a number. */
  amount: string;
  /** True when the free higher education subsidy covers this line. */
  coveredByFhe: boolean;
}

/**
 * GET /student/account: the signed-in student's billing for the current term. Every amount is
 * a two-place decimal string in pesos, exactly as the API computed it; the client displays
 * them and never adds, subtracts, or compares them as numbers.
 */
export interface StudentAccount {
  /** Includes the late fine once it applies. */
  amountAssessed: string;
  /** "0.00" when no subsidy applies. */
  subsidyApplied: string;
  /** What is still owed: after the subsidy and recorded payments, with any late fine. */
  netPayable: string;
  paymentStatus: AccountPaymentStatus;
  fheQualified: boolean;
  fheForfeited: boolean;
  fheForfeitureReason: string | null;
  lines: AccountLine[];
  /**
   * The API sends no separate overdue figures: the balance past due is `netPayable`, and the
   * penalty is the "Late payment fine" line. Both are picked out here as the API's own text,
   * never calculated. Null when the account is not overdue, or no fine has been applied yet.
   */
  overdueAmount: string | null;
  penaltyAmount: string | null;
}

/** One payment on the student's history. */
export interface StudentPayment {
  /** The gateway reference, which the API keeps unique. */
  id: string;
  /** An instant, ISO 8601: when it was paid, or created if still unpaid. */
  paidAt: string;
  amount: string;
  reference: string;
  /** "PAID", "PENDING", ... as the gateway reports it. */
  status: string;
  /**
   * The payment's UUID, which GET /student/payments/{payment_id}/receipt needs. The history
   * list does not send one today (only date, amount, reference, and status), so this is null
   * until the API adds `paymentId`; a value that is not a UUID is never kept.
   */
  paymentId: string | null;
  /**
   * Where the receipt is. The API does not send one yet, so this is null today; it is read
   * from `receiptUrl` if the API adds that field.
   */
  receiptUrl: string | null;
}

/** A payment that went through: the only kind that has a receipt. */
export function isSettled(payment: Pick<StudentPayment, "status">): boolean {
  return payment.status.toUpperCase() === "PAID";
}

const AMOUNT = /^-?\d+(\.\d+)?$/;

/** A peso amount, kept as the text the API sent. A JSON number is read back as its text. */
export function amount(value: unknown): string {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  return typeof text === "string" && AMOUNT.test(text) ? text : parse.invalid();
}

function parseLine(value: unknown): AccountLine {
  const line = parse.record(value);
  return {
    description: parse.string(line.description),
    amount: amount(line.amount),
    coveredByFhe: parse.boolean(line.coveredByFhe),
  };
}

/** Narrow a GET /student/account body at the boundary; every amount stays text. */
export function parseStudentAccount(body: unknown): StudentAccount {
  const account = parse.record(body);
  const paymentStatus = parse.oneOf(account.paymentStatus, PAYMENT_STATUSES);
  const netPayable = amount(account.netPayable);
  const lines = parse.array(account.lines).map(parseLine);
  const overdue = paymentStatus === PAYMENT_OVERDUE;
  return {
    amountAssessed: amount(account.amountAssessed),
    subsidyApplied: amount(account.subsidyApplied),
    netPayable,
    paymentStatus,
    fheQualified: parse.boolean(account.fheQualified),
    fheForfeited: parse.boolean(account.fheForfeited),
    fheForfeitureReason: parse.optionalString(account.fheForfeitureReason),
    lines,
    overdueAmount: overdue ? netPayable : null,
    penaltyAmount: overdue
      ? (lines.find((line) => line.description === LATE_FINE_DESCRIPTION)?.amount ?? null)
      : null,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The payment's UUID from `paymentId` (or `id`), or null when there is none or it is not one. */
function paymentUuid(payment: Record<string, unknown>): string | null {
  for (const value of [payment.paymentId, payment.id]) {
    if (typeof value === "string" && UUID.test(value)) return value;
  }
  return null;
}

function parsePayment(value: unknown): StudentPayment {
  const payment = parse.record(value);
  const reference = parse.string(payment.reference);
  return {
    id: reference,
    paidAt: parse.string(payment.date),
    amount: amount(payment.amount),
    reference,
    status: parse.string(payment.status),
    paymentId: paymentUuid(payment),
    receiptUrl: parse.optionalString(payment.receiptUrl),
  };
}

/** The signed-in student's billing statement and payment history (US-FIN-001). */
export function createStudentAccountApi(client: ApiClient) {
  return {
    /**
     * Refusals arrive as ApiError: 404 RESOURCE_NOT_FOUND when there is no current term or no
     * billing account yet; 503 SERVICE_UNAVAILABLE when the figures cannot be verified.
     */
    async account(accessToken: string): Promise<StudentAccount> {
      const body = await client.request("/student/account", { method: "GET", accessToken });
      return parseStudentAccount(body);
    },

    /** Newest first, across terms. An empty history is an empty array. */
    async payments(accessToken: string): Promise<StudentPayment[]> {
      const body = await client.request("/student/payments", { method: "GET", accessToken });
      return parse.array(body).map(parsePayment);
    },
  };
}

export type StudentAccountApi = ReturnType<typeof createStudentAccountApi>;
