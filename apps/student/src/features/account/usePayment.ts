import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import {
  classifyPaymentError,
  PAYMENT_FAILED,
  PAYMENT_PENDING,
  PAYMENT_SETTLED,
  type PaymentDetail,
  type PaymentRequest,
  type StudentAccount,
} from "@cbpupsis/shared/account";
import { errorMessage } from "@cbpupsis/shared/api";

import { session, studentPaymentsApi as api } from "../../lib/auth";

// US-FIN-002. The page renders; everything that talks to the API, or decides what an answer
// means, is here. Amounts are the API's text throughout: nothing is added or compared.

/** The four payment calls, with the session's token applied. The page only sees this shape. */
export interface PaymentsClient {
  account(): Promise<StudentAccount>;
  create(request: PaymentRequest, idempotencyKey: string): Promise<PaymentDetail>;
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
  return payment !== undefined && payment.status !== PAYMENT_PENDING;
}

/**
 * GET /student/payments/{payment_id}: the first call after `firstDelayMs` (the 409's
 * Retry-After, AC-FIN-002.4), then every few seconds until the payment is settled or failed.
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
  reference: string | null;
  /** An instant, ISO 8601. */
  occurredAt: string;
  /** The gateway's own words, or null when it gave none. */
  reason: string | null;
}

/** What the page shows for the payment attempt in front of the student. */
export type PayView =
  | { kind: "form"; amountError: string | null; notice: string | null }
  | { kind: "submitting" }
  /** 409, or accepted and not yet settled (AC-FIN-002.4). */
  | { kind: "in-progress"; paymentId: string | null }
  /** 504: do not pay again. */
  | { kind: "timeout"; paymentId: string | null }
  | { kind: "success"; payment: PaymentDetail }
  | { kind: "failed"; failure: FailureView };

type Attempt =
  | { phase: "form"; amountError: string | null; notice: string | null }
  | { phase: "submitting" }
  | {
      phase: "tracking";
      paymentId: string | null;
      delayMs: number;
      cause: "accepted" | "in-progress" | "timeout";
    }
  | { phase: "failed"; failure: FailureView };

const IDLE: Attempt = { phase: "form", amountError: null, notice: null };

/** The same request is the same payment: one key for it, until it is settled or refused. */
function fingerprint(request: PaymentRequest) {
  return `${request.method}|${request.amount}`;
}

/**
 * One payment attempt, start to finish.
 *
 *  - One UUID `Idempotency-Key` per attempt (AC-FIN-002.1). A retry after a network error sends
 *    the same request, so it keeps the same key; a request that changed, or that the API
 *    refused, gets a new one.
 *  - The first click locks the form, and a ref guards the same instant, so a double click can
 *    send only one request (AC-FIN-002.2, AC-FIN-002.3).
 *  - A 502 shows the failure; `tryAgain` forgets the key, so the next attempt has a new one
 *    (AC-FIN-002.10).
 */
export function usePayAttempt(client: PaymentsClient, source: PaySource) {
  const [attempt, setAttempt] = useState<Attempt>(IDLE);
  const key = useRef<{ value: string; fingerprint: string } | null>(null);
  const inFlight = useRef(false);

  const create = useMutation({
    mutationFn: (call: { request: PaymentRequest; key: string }) =>
      client.create(call.request, call.key),
    gcTime: 0,
  });

  const tracking = attempt.phase === "tracking" ? attempt : null;
  const poll = usePaymentPoll(client, source, tracking?.paymentId ?? null, tracking?.delayMs ?? 0);

  async function submit(request: PaymentRequest) {
    if (inFlight.current) return;
    inFlight.current = true;
    setAttempt({ phase: "submitting" });

    const print = fingerprint(request);
    if (key.current?.fingerprint !== print) {
      key.current = { value: crypto.randomUUID(), fingerprint: print };
    }

    try {
      const payment = await create.mutateAsync({ request, key: key.current.value });
      // What was accepted is read back from the payment itself, never from this response.
      setAttempt({ phase: "tracking", paymentId: payment.id, delayMs: 0, cause: "accepted" });
    } catch (error) {
      const outcome = classifyPaymentError(error);
      switch (outcome.kind) {
        case "validation":
          // Refused outright: nothing was created, so the corrected request starts afresh.
          key.current = null;
          setAttempt({ phase: "form", amountError: outcome.message, notice: null });
          break;
        case "in-progress":
          setAttempt({
            phase: "tracking",
            paymentId: outcome.paymentId,
            delayMs: clampWait(outcome.retryAfterMs),
            cause: "in-progress",
          });
          break;
        case "gateway-timeout":
          // Unknown: it may yet go through. Stay locked; never invite a second payment.
          setAttempt({
            phase: "tracking",
            paymentId: outcome.paymentId,
            delayMs: clampWait(outcome.retryAfterMs),
            cause: "timeout",
          });
          break;
        case "gateway-error":
          setAttempt({
            phase: "failed",
            failure: {
              reference: outcome.reference,
              occurredAt: outcome.occurredAt ?? new Date().toISOString(),
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
      inFlight.current = false;
    }
  }

  /** Back to the form after a failure, as a new attempt with a new key (AC-FIN-002.10). */
  function tryAgain() {
    key.current = null;
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
    case "failed":
      return { kind: "failed", failure: attempt.failure };
    case "tracking": {
      if (polled?.status === PAYMENT_SETTLED) return { kind: "success", payment: polled };
      if (polled?.status === PAYMENT_FAILED) {
        return {
          kind: "failed",
          failure: {
            reference: polled.reference,
            occurredAt: polled.processedAt ?? new Date(polledAt).toISOString(),
            reason: polled.failureReason,
          },
        };
      }
      return attempt.cause === "timeout"
        ? { kind: "timeout", paymentId: attempt.paymentId }
        : { kind: "in-progress", paymentId: attempt.paymentId };
    }
  }
}

/** GET /student/payments/{payment_id}/receipt, handed to the browser as a file (AC-FIN-002.9). */
export function useReceiptDownload(client: PaymentsClient) {
  return useMutation({
    mutationFn: async (payment: { id: string; reference: string | null }) => {
      const file = await client.receipt(payment.id);
      const url = URL.createObjectURL(file);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = `receipt-${payment.reference ?? payment.id}`;
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
