import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  classifyPaymentError,
  PAYMENT_FAILED,
  PAYMENT_PAID,
  PAYMENT_PENDING,
  type PaymentCreated,
  type PaymentDetail,
  type PaymentRequest,
  type StudentAccount,
} from "@cbpupsis/shared/account";
import { errorMessage } from "@cbpupsis/shared/api";

import { session, studentPaymentsApi as api } from "../../lib/auth";

// US-FIN-002. The page renders; everything that talks to the API, or decides what an answer
// means, is here. Amounts are the API's text throughout: nothing is added or compared.
//
// The flow (see packages/shared/src/account/payments.ts): POST creates one hosted checkout, the
// student pays on the gateway's page, and the gateway sends them back to the portal, where
// GET /student/payments/{id} says how it ended.

/** The payment calls, with the session's token applied. The page only sees this shape. */
export interface PaymentsClient {
  account(): Promise<StudentAccount>;
  create(request: PaymentRequest, idempotencyKey: string): Promise<PaymentCreated>;
  get(paymentId: string): Promise<PaymentDetail>;
  receipt(paymentId: string): Promise<Blob>;
}

/**
 * The real API. A 401 refreshes the session and repeats the call with the same arguments, so a
 * payment retried that way carries the same `Idempotency-Key`.
 */
export const livePaymentsClient: PaymentsClient = {
  account: () => session.authorized((token) => api.account(token)),
  create: (request, key) => session.authorized((token) => api.create(token, request, key)),
  get: (paymentId) => session.authorized((token) => api.get(token, paymentId)),
  receipt: (paymentId) => session.authorized((token) => api.receipt(token, paymentId)),
};

/**
 * Send the student to the gateway's page. True when the browser is leaving; false when nothing
 * was left to do (a preview), so the page carries on as if the student had come back. A
 * property so a test can stand in for it.
 */
export const checkout = {
  go(url: string): boolean {
    window.location.assign(url);
    return true;
  },
};

// The gateway sends the student back to a fixed address that names no payment, so the id is
// kept for the trip. It is an opaque id, not a record or a token, and it lives in this tab only.
const PENDING_KEY = "cbpupsis.pay.pending";

export function rememberPendingPayment(paymentId: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, paymentId);
  } catch {
    // Storage can be blocked; the student then finds the result in Billing & Payments.
  }
}

export function readPendingPayment(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

export function clearPendingPayment(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to clear.
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The payment a return address names, if it does: `?payment_id=` or `?paymentId=`. The API's
 * return URLs are fixed and name none today, so this only serves a deployment that adds one.
 * Anything that is not a UUID is ignored, never sent to the API.
 */
export function paymentIdFromSearch(search: unknown): string | null {
  if (typeof search !== "object" || search === null) return null;
  const record = search as Record<string, unknown>;
  for (const value of [record.payment_id, record.paymentId]) {
    if (typeof value === "string" && UUID.test(value)) return value;
  }
  return null;
}

/** "live", or the name of a preview scenario: keeps preview data out of the real cache. */
export type PaySource = string;

export const payKeys = {
  all: ["pay"] as const,
  account: (source: PaySource) => [...payKeys.all, source, "account"] as const,
  payment: (source: PaySource, paymentId: string | null) =>
    [...payKeys.all, source, "payment", paymentId] as const,
};

/** GET /student/account for the payment page. */
export function usePayAccount(client: PaymentsClient, source: PaySource, quickFail: boolean) {
  return useQuery({
    queryKey: payKeys.account(source),
    queryFn: () => client.account(),
    // A developer previewing before the API exists should not wait out the retries.
    ...(quickFail ? { retry: false } : {}),
  });
}

/** Ask again this often once the API has not said how long to wait. */
const POLL_MS = 5_000;
/** However long the API says to wait, wait at least this long and at most this long. */
const MIN_WAIT_MS = 1_000;
const MAX_WAIT_MS = 60_000;

function clampWait(ms: number | null): number {
  return ms === null ? POLL_MS : Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, ms));
}

function isFinal(payment: PaymentDetail | undefined): boolean {
  return payment !== undefined && payment.state !== PAYMENT_PENDING;
}

/**
 * GET /student/payments/{payment_id}: the first call after `firstDelayMs`, then every few
 * seconds until the payment is PAID or FAILED.
 */
export function usePaymentPoll(
  client: PaymentsClient,
  source: PaySource,
  paymentId: string | null,
  firstDelayMs: number,
) {
  const [armedFor, setArmedFor] = useState<string | null>(null);

  useEffect(() => {
    if (paymentId === null) return;
    const timer = setTimeout(() => setArmedFor(paymentId), firstDelayMs);
    return () => clearTimeout(timer);
  }, [paymentId, firstDelayMs]);

  return useQuery({
    queryKey: payKeys.payment(source, paymentId),
    queryFn: () => client.get(paymentId ?? ""),
    enabled: paymentId !== null && armedFor === paymentId,
    retry: false,
    gcTime: 0,
    refetchInterval: (query) => (isFinal(query.state.data) ? false : POLL_MS),
  });
}

/** What the failed-payment screen shows. */
export interface FailureView {
  /** The gateway's reference, when the API has one: a refusal at checkout has none. */
  reference: string | null;
  /** An instant, ISO 8601: when the page learned of the failure. */
  occurredAt: string;
  /** The gateway's own words, or null when it gave none. */
  reason: string | null;
}

/** What the page shows for the payment attempt in front of the student. */
export type PayView =
  | { kind: "form"; amountError: string | null; notice: string | null }
  | { kind: "submitting" }
  /** On its way to the gateway's page. */
  | { kind: "redirecting"; checkoutUrl: string }
  /** 409, or back from the gateway and not settled yet (AC-FIN-002.4). */
  | { kind: "in-progress" }
  /** 504: do not pay again. */
  | { kind: "timeout" }
  | { kind: "success"; payment: PaymentDetail }
  | { kind: "failed"; failure: FailureView };

/** How the page was opened: fresh, or back from the gateway. */
export type PayEntry =
  | { kind: "new" }
  /** Back at the gateway's success address, with the payment known. */
  | { kind: "returned"; paymentId: string }
  /** Back at the gateway's success address, but no payment was named or remembered. */
  | { kind: "returned-unknown" }
  /** The student left the gateway's page without paying. */
  | { kind: "cancelled" };

type FormAttempt = { phase: "form"; amountError: string | null; notice: string | null };

type Attempt =
  | FormAttempt
  | { phase: "submitting" }
  | { phase: "waiting" }
  | { phase: "redirecting"; checkoutUrl: string }
  | { phase: "tracking"; paymentId: string; delayMs: number }
  | { phase: "timeout" }
  | { phase: "failed"; failure: FailureView };

const IDLE: FormAttempt = { phase: "form", amountError: null, notice: null };

function startOf(entry: PayEntry): Attempt {
  switch (entry.kind) {
    case "new":
      return IDLE;
    case "returned":
      return { phase: "tracking", paymentId: entry.paymentId, delayMs: 0 };
    case "returned-unknown":
      return {
        ...IDLE,
        notice:
          "We could not tell which payment you just made. Check Billing & Payments before paying again.",
      };
    case "cancelled":
      return {
        ...IDLE,
        // The API keeps a PENDING payment's amount reserved on the balance until it reconciles it
        // (PAYMENT_RECONCILIATION_PENDING_SECONDS, 300 by default), so an immediate retry for the
        // full balance can be refused with AMOUNT_EXCEEDS_BALANCE.
        notice:
          'You left the payment page before it finished. If you were not charged, the amount stays reserved on your balance for about 5 minutes, until the system reconciles it. If you try again right away, you may be told that "The payment amount exceeds the available balance." Wait a few minutes and try again.',
      };
  }
}

/** The same request is the same payment: one key for it, until it is paid or refused. */
function fingerprint(request: PaymentRequest) {
  return request.amount;
}

/**
 * One payment attempt, start to finish.
 *
 *  - One UUID `Idempotency-Key` per attempt (AC-FIN-002.1). A retry after a network error sends
 *    the same request, so it keeps the same key; a request that changed, or that the API
 *    refused, gets a new one.
 *  - The first click locks the form, and a ref guards the same instant, so a double click can
 *    send only one request (AC-FIN-002.2, AC-FIN-002.3).
 *  - A 409 means the first call with this key is still being made. It names no payment, so the
 *    same request is sent again with the same key once Retry-After has passed, which returns
 *    the first call's answer (AC-FIN-002.4).
 *  - A 502 shows the failure; `tryAgain` forgets the key, so the next attempt has a new one
 *    (AC-FIN-002.10).
 *  - A 504 locks the form for good: the attempt may still go through, and its key would only
 *    replay the 504. The API refuses a second payment for a balance already reserved.
 *  - A created payment that is not PENDING needs no trip to the gateway: it is read at once.
 */
export function usePayAttempt(
  client: PaymentsClient,
  source: PaySource,
  options: { entry?: PayEntry; redirect?: (url: string) => boolean } = {},
) {
  const { entry = { kind: "new" }, redirect = checkout.go } = options;
  const [attempt, setAttempt] = useState<Attempt>(() => startOf(entry));
  const key = useRef<{ value: string; fingerprint: string } | null>(null);
  const inFlight = useRef(false);
  const replay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(replay.current), []);

  const create = useMutation({
    mutationFn: (call: { request: PaymentRequest; key: string }) =>
      client.create(call.request, call.key),
    gcTime: 0,
  });

  const tracking = attempt.phase === "tracking" ? attempt : null;
  const poll = usePaymentPoll(client, source, tracking?.paymentId ?? null, tracking?.delayMs ?? 0);

  // Leaving the gateway's page unpaid ends the trip too: forget the remembered payment.
  const cancelled = entry.kind === "cancelled";
  useEffect(() => {
    if (cancelled) clearPendingPayment();
  }, [cancelled]);

  // Once the gateway has answered, the trip is over: forget the remembered payment.
  const answered = isFinal(poll.data);
  useEffect(() => {
    if (answered) clearPendingPayment();
  }, [answered]);

  async function run(request: PaymentRequest, idempotencyKey: string) {
    let waiting = false;
    try {
      const created = await create.mutateAsync({ request, key: idempotencyKey });
      // Remembered before the student leaves: the gateway's return address names no payment.
      rememberPendingPayment(created.paymentId);
      const leaving = created.state === PAYMENT_PENDING && redirect(created.checkoutUrl);
      setAttempt(
        leaving
          ? { phase: "redirecting", checkoutUrl: created.checkoutUrl }
          : { phase: "tracking", paymentId: created.paymentId, delayMs: 0 },
      );
    } catch (error) {
      const outcome = classifyPaymentError(error);
      switch (outcome.kind) {
        case "validation":
          // Refused outright: nothing was created, so the corrected request starts afresh.
          key.current = null;
          setAttempt({ phase: "form", amountError: outcome.message, notice: null });
          break;
        case "in-progress":
          waiting = true;
          setAttempt({ phase: "waiting" });
          replay.current = setTimeout(
            () => void run(request, idempotencyKey),
            clampWait(outcome.retryAfterMs),
          );
          break;
        case "gateway-timeout":
          // Unknown: it may yet go through. Stay locked; never invite a second payment.
          setAttempt({ phase: "timeout" });
          break;
        case "gateway-error":
          setAttempt({
            phase: "failed",
            failure: {
              reference: null,
              occurredAt: new Date().toISOString(),
              reason: outcome.reason,
            },
          });
          break;
        case "network":
          // Keep the key: the request may have arrived, and the same key makes a retry safe.
          setAttempt({
            phase: "form",
            amountError: null,
            notice:
              "We could not confirm your payment because the connection dropped. Press Pay to try again; you will not be charged twice.",
          });
          break;
        case "other":
          setAttempt({ phase: "form", amountError: null, notice: errorMessage(outcome.error) });
          break;
      }
    } finally {
      if (!waiting) inFlight.current = false;
    }
  }

  async function submit(request: PaymentRequest) {
    if (inFlight.current) return;
    inFlight.current = true;
    setAttempt({ phase: "submitting" });

    const print = fingerprint(request);
    if (key.current?.fingerprint !== print) {
      key.current = { value: crypto.randomUUID(), fingerprint: print };
    }
    await run(request, key.current.value);
  }

  /** Back to the form after a failure, as a new attempt with a new key (AC-FIN-002.10). */
  function tryAgain() {
    key.current = null;
    clearPendingPayment();
    setAttempt(IDLE);
  }

  function clearAmountError() {
    setAttempt((current) =>
      current.phase === "form" && current.amountError !== null
        ? { ...current, amountError: null }
        : current,
    );
  }

  const view = derive(attempt, poll.data, poll.dataUpdatedAt);
  return { view, submit, tryAgain, clearAmountError };
}

function derive(attempt: Attempt, polled: PaymentDetail | undefined, polledAt: number): PayView {
  switch (attempt.phase) {
    case "form":
      return { kind: "form", amountError: attempt.amountError, notice: attempt.notice };
    case "submitting":
      return { kind: "submitting" };
    case "waiting":
      return { kind: "in-progress" };
    case "redirecting":
      return { kind: "redirecting", checkoutUrl: attempt.checkoutUrl };
    case "timeout":
      return { kind: "timeout" };
    case "failed":
      return { kind: "failed", failure: attempt.failure };
    case "tracking": {
      if (polled?.state === PAYMENT_PAID) return { kind: "success", payment: polled };
      if (polled?.state === PAYMENT_FAILED) {
        return {
          kind: "failed",
          failure: {
            reference: polled.reference,
            occurredAt: new Date(polledAt).toISOString(),
            // The status call carries no reason; the gateway's is only sent with a 502.
            reason: null,
          },
        };
      }
      return { kind: "in-progress" };
    }
  }
}

/** GET /student/payments/{payment_id}/receipt, handed to the browser as a file (AC-FIN-002.9). */
export function useReceiptDownload(client: PaymentsClient) {
  return useMutation({
    mutationFn: async (payment: { id: string; receiptNumber: string | null }) => {
      const file = await client.receipt(payment.id);
      const url = URL.createObjectURL(new Blob([file], { type: "application/pdf" }));
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `payment-receipt-${payment.receiptNumber ?? payment.id}.pdf`;
        document.body.append(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    gcTime: 0,
  });
}
