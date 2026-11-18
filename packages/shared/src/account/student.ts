import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

/** A settled payment: the only status that has a receipt. */
export const PAYMENT_SETTLED = "SETTLED";

/** The account's `paymentStatus` when a payment is past its due date. */
export const PAYMENT_OVERDUE = "OVERDUE";

/** One fee on the current semester's assessment. */
export interface AccountLine {
  /** The fee's code: "TUITION", "REGISTRATION", ... */
  code: string;
  /** What the student reads: "Tuition (18 units)". */
  description: string;
  /** Pesos, as the API sends them: "3000.00". Never parsed into a number. */
  amount: string;
  /** True when the free higher education subsidy covers this line. */
  coveredBySubsidy: boolean;
}

/**
 * GET /student/account: the signed-in student's billing for the current term. Every amount is
 * a decimal string in pesos, exactly as the API computed it; the client displays them and
 * never adds, subtracts, or compares them as numbers.
 */
export interface StudentAccount {
  amountAssessed: string;
  /** Null when no subsidy applies (it was never granted, or it was forfeited). */
  subsidyApplied: string | null;
  netPayable: string;
  /** "PAID", "UNPAID", "OVERDUE", ... as the API sends it. */
  paymentStatus: string;
  fheForfeited: boolean;
  fheForfeitureReason: string | null;
  /** What is past due, with the penalty on it. Only sent when `paymentStatus` is OVERDUE. */
  overdueAmount: string | null;
  penaltyAmount: string | null;
  /** The gateway's fee for paying online. Null or absent when the API sends none. */
  processingFee?: string | null;
  /** What paying everything costs, fee and penalty included, as the API computed it. */
  totalAmountDue?: string | null;
  lines: AccountLine[];
}

/** One payment on the student's history. */
export interface StudentPayment {
  id: string;
  /** An instant, ISO 8601. */
  paidAt: string;
  amount: string;
  reference: string;
  /** "SETTLED", "PENDING", "FAILED", ... as the API sends it. */
  status: string;
  /** Where the receipt is. Only a settled payment has one. */
  receiptUrl: string | null;
}

const AMOUNT = /^-?\d+(\.\d+)?$/;

/** A peso amount, kept as the text the API sent. A JSON number is read back as its text. */
export function amount(value: unknown): string {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  return typeof text === "string" && AMOUNT.test(text) ? text : parse.invalid();
}

export function optionalAmount(value: unknown): string | null {
  return value === undefined || value === null ? null : amount(value);
}

function parseLine(value: unknown): AccountLine {
  const line = parse.record(value);
  return {
    code: parse.string(line.code),
    description: parse.string(line.description),
    amount: amount(line.amount),
    coveredBySubsidy: parse.boolean(line.coveredBySubsidy),
  };
}

/** Narrow a GET /student/account body at the boundary; every amount stays text. */
export function parseStudentAccount(body: unknown): StudentAccount {
  const account = parse.record(body);
  return {
    amountAssessed: amount(account.amountAssessed),
    subsidyApplied: optionalAmount(account.subsidyApplied),
    netPayable: amount(account.netPayable),
    paymentStatus: parse.string(account.paymentStatus),
    fheForfeited: parse.boolean(account.fheForfeited),
    fheForfeitureReason: parse.optionalString(account.fheForfeitureReason),
    overdueAmount: optionalAmount(account.overdueAmount),
    penaltyAmount: optionalAmount(account.penaltyAmount),
    processingFee: optionalAmount(account.processingFee),
    totalAmountDue: optionalAmount(account.totalAmountDue),
    lines: parse.array(account.lines).map(parseLine),
  };
}

function parsePayment(value: unknown): StudentPayment {
  const payment = parse.record(value);
  return {
    id: parse.string(payment.id),
    paidAt: parse.string(payment.paidAt),
    amount: amount(payment.amount),
    reference: parse.string(payment.reference),
    status: parse.string(payment.status),
    receiptUrl: parse.optionalString(payment.receiptUrl),
  };
}

/** The signed-in student's billing statement and payment history (US-FIN-001). */
export function createStudentAccountApi(client: ApiClient) {
  return {
    async account(accessToken: string): Promise<StudentAccount> {
      const body = await client.request("/student/account", { method: "GET", accessToken });
      return parseStudentAccount(body);
    },

    /** In the order the API sends them; the page sorts them. */
    async payments(accessToken: string): Promise<StudentPayment[]> {
      const body = await client.request("/student/payments", { method: "GET", accessToken });
      return parse.array(parse.record(body).items).map(parsePayment);
    },
  };
}

export type StudentAccountApi = ReturnType<typeof createStudentAccountApi>;
