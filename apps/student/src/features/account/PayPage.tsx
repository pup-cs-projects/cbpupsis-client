import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { type PaymentDetail, type StudentAccount } from "@cbpupsis/shared/account";
import { errorMessage } from "@cbpupsis/shared/api";

import { formatTimestamp } from "../../lib/datetime";
import { formatPesoAmount, isZeroAmount } from "../../lib/money";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import {
  initialPreview,
  PREVIEW_SCENARIOS,
  previewAllowed,
  previewFallback,
  previewPaymentsClient,
  type PreviewScenario,
} from "./payPreview";
import {
  livePaymentsClient,
  paymentIdFromSearch,
  payKeys,
  readPendingPayment,
  useReceiptDownload,
  usePayAccount,
  usePayAttempt,
  type FailureView,
  type PayEntry,
  type PaymentsClient,
} from "./usePayment";

// US-FIN-002: pay the balance online. Every peso figure below is the API's text, shown through
// formatPesoAmount (two decimals). Nothing is added, subtracted, or compared as a number.
//
// The student does not type card details here. Pressing Pay creates one hosted checkout and
// sends them to the gateway's page; the gateway sends them back to /payments/success or
// /payments/cancel, and this page then reads how the payment ended.

const CARD = "bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-sm";
/** The checkout cards: the same surface, with the tighter padding a two-column grid wants. */
const PANEL = "bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm";
const ROW = "flex items-baseline justify-between gap-4 py-1.5";
const ROW_LABEL = "text-sm text-neutral-600";
const ROW_VALUE = "text-sm font-medium text-neutral-900 tabular-nums text-right";
const PRIMARY_BUTTON =
  "min-w-[180px] h-11 px-6 rounded-xl bg-[#7B1113] hover:bg-[#630e10] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center justify-center shadow-sm transition-colors";
const SECONDARY_BUTTON =
  "min-w-[160px] h-11 px-6 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 text-sm font-semibold inline-flex items-center justify-center transition-colors";
const ACTIONS = "flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6";
/** The summary's buttons: stacked in the narrow sticky column, side by side where it is wide. */
const SUMMARY_ACTIONS =
  "flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center lg:items-stretch xl:items-center gap-3 mt-6";

/**
 * The API sends no processing fee: the gateway charges the student exactly the amount the
 * checkout was created for. So the row shows zero, as the API's own text.
 */
const NONE = "0.00";

// ---- Shared pieces ----

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={ROW}>
      <dt className={ROW_LABEL}>{label}</dt>
      <dd className={ROW_VALUE}>{children}</dd>
    </div>
  );
}

function Divider() {
  return <hr className="my-4 border-t border-neutral-100" />;
}

function TotalRow({
  label,
  amount,
  inColumn = false,
}: {
  label: string;
  amount: string;
  /** In the checkout's narrow right column the figure steps back down to 3xl at lg. */
  inColumn?: boolean;
}) {
  return (
    <dl>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <dt className="text-base font-bold text-neutral-900">{label}</dt>
        <dd
          className={`text-right text-3xl font-bold text-[#7B1113] tabular-nums sm:text-4xl ${
            inColumn ? "lg:text-3xl" : ""
          }`}
        >
          {formatPesoAmount(amount)}
        </dd>
      </div>
    </dl>
  );
}

function BackLink({ className }: { className: string }) {
  return (
    <Link to="/account" className={className}>
      Back to Billing &amp; Payments
    </Link>
  );
}

/** A result screen opens with its heading focused, so a screen reader announces the outcome. */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

function Loading() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading your balance
      </p>
      <div aria-hidden="true" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <div className="h-40 animate-pulse rounded-2xl bg-neutral-200/60 motion-reduce:animate-none" />
          <div className="h-44 animate-pulse rounded-2xl bg-neutral-200/60 motion-reduce:animate-none" />
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-neutral-200/60 motion-reduce:animate-none lg:col-span-5" />
      </div>
    </div>
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className={`${CARD} text-center`}>
      <p role="alert" className="font-semibold text-neutral-900">
        We couldn&apos;t load your balance. {errorMessage(error)}
      </p>
      <button type="button" onClick={onRetry} className={`${PRIMARY_BUTTON} mt-5`}>
        Retry
      </button>
    </div>
  );
}

function PreviewBar({
  scenario,
  onChange,
}: {
  scenario: PreviewScenario;
  onChange: (next: PreviewScenario) => void;
}) {
  return (
    <div
      role="note"
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p>
        Preview: sample data, and no real payment is made. Choose what happens when you press Pay.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {PREVIEW_SCENARIOS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === scenario}
            onClick={() => onChange(id)}
            className={
              id === scenario
                ? "h-9 rounded-lg border-2 border-[#7B1113] px-3 text-sm font-semibold text-[#7B1113]"
                : "h-9 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 hover:border-neutral-400"
            }
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- The form ----

/** Where the student pays: not here. The API takes no method; the gateway's page asks for it. */
function CheckoutCard() {
  return (
    <section className={PANEL}>
      <h2 className="mb-4 text-xl font-bold text-neutral-900">Secure Checkout</h2>
      <p className="text-sm text-neutral-700">
        You choose how to pay on our payment partner&apos;s secure page, which opens when you press
        Pay. This portal never sees your card or account details.
      </p>
    </section>
  );
}

function PaymentForm({
  account,
  attempt,
  typed,
  onTyped,
  locked,
  banner,
}: {
  account: StudentAccount;
  attempt: ReturnType<typeof usePayAttempt>;
  /** What the student typed; null until they edit it, when the field shows the API's balance. */
  typed: string | null;
  onTyped: (next: string) => void;
  /** True once a payment is on its way: the form can be read but not sent again. */
  locked: boolean;
  banner: ReactNode;
}) {
  const { view } = attempt;
  const [formatError, setFormatError] = useState<string | null>(null);

  const amount = typed ?? account.netPayable;
  const submitting = view.kind === "submitting";
  const noBalance = isZeroAmount(account.netPayable);
  const amountError = formatError ?? (view.kind === "form" ? view.amountError : null);
  const notice = view.kind === "form" ? view.notice : null;
  const disabled = locked || submitting;

  function pay() {
    const text = amount.trim();
    // Text checks only: the API decides whether the amount is allowed (422).
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
      setFormatError("Enter an amount in pesos, such as 1500.00.");
      return;
    }
    if (isZeroAmount(text)) {
      setFormatError("Enter an amount above zero.");
      return;
    }
    setFormatError(null);
    void attempt.submit({ amount: text });
  }

  return (
    <>
      {banner}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <CheckoutCard />

          <section className={PANEL} aria-labelledby="payment-amount-heading">
            <h2 id="payment-amount-heading" className="mb-4 text-xl font-bold text-neutral-900">
              Payment Amount
            </h2>
            <label htmlFor="pay-amount" className="block text-sm font-semibold text-neutral-900">
              Amount to pay
            </label>
            <div className="mt-2 flex items-center gap-2">
              <span aria-hidden="true" className="text-neutral-600">
                &#8369;
              </span>
              <input
                id="pay-amount"
                name="amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                disabled={disabled || noBalance}
                onChange={(event) => {
                  onTyped(event.target.value);
                  setFormatError(null);
                  attempt.clearAmountError();
                }}
                aria-invalid={amountError !== null}
                aria-describedby={amountError === null ? "pay-amount-help" : "pay-amount-error"}
                className={`h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-right text-base text-neutral-900 tabular-nums disabled:bg-neutral-50 disabled:text-neutral-600 ${
                  amountError === null ? "border-neutral-300" : "border-red-600"
                }`}
              />
            </div>
            {amountError === null ? (
              <p id="pay-amount-help" className="mt-1.5 text-xs text-neutral-600">
                {noBalance
                  ? "You have no outstanding balance."
                  : "Pay the full balance, or enter a smaller amount."}
              </p>
            ) : (
              <p
                id="pay-amount-error"
                role="alert"
                className="mt-1.5 text-sm font-medium text-red-700"
              >
                {amountError}
              </p>
            )}
          </section>
        </div>

        <section
          className={`${PANEL} lg:sticky lg:top-6 lg:col-span-5`}
          aria-labelledby="payment-summary-form-heading"
        >
          <h2 id="payment-summary-form-heading" className="mb-5 text-xl font-bold text-neutral-900">
            Payment Summary
          </h2>
          <dl>
            <Row label="Outstanding Balance">{formatPesoAmount(account.netPayable)}</Row>
            <Row label="Processing Fee">{formatPesoAmount(NONE)}</Row>
            <Row label="Late Fees">{formatPesoAmount(account.penaltyAmount ?? NONE)}</Row>
          </dl>
          {account.penaltyAmount !== null && (
            <p className="mt-1 text-xs text-neutral-500">
              Your outstanding balance already includes late fees.
            </p>
          )}
          <Divider />
          <TotalRow label="Total Amount Due" amount={account.netPayable} inColumn />

          <p className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0" />
            Single-submission protection active. Your account updates automatically upon
            confirmation.
          </p>

          {notice !== null && (
            <p role="alert" className="mt-5 text-sm font-medium text-red-700">
              {notice}
            </p>
          )}

          <div className={SUMMARY_ACTIONS}>
            <button
              type="button"
              onClick={pay}
              disabled={disabled || noBalance}
              aria-busy={submitting}
              className={PRIMARY_BUTTON}
            >
              {submitting ? "Processing…" : "Pay"}
            </button>
            <Link to="/account" className={SECONDARY_BUTTON}>
              Cancel
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

// ---- The panels shown above a locked form ----

function InProgressPanel() {
  return (
    <div role="status" className={`${CARD} mb-6 flex items-start gap-4`}>
      <Loader2
        aria-hidden="true"
        className="mt-0.5 size-6 shrink-0 animate-spin text-[#7B1113] motion-reduce:animate-none"
      />
      <div>
        <p className="text-base font-bold text-neutral-900">Your payment is still processing.</p>
        <p className="mt-1 text-sm text-neutral-600">
          This page updates by itself. Please do not pay again.
        </p>
      </div>
    </div>
  );
}

function RedirectPanel({ checkoutUrl }: { checkoutUrl: string }) {
  return (
    <div role="status" className={`${CARD} mb-6 flex items-start gap-4`}>
      <Loader2
        aria-hidden="true"
        className="mt-0.5 size-6 shrink-0 animate-spin text-[#7B1113] motion-reduce:animate-none"
      />
      <div>
        <p className="text-base font-bold text-neutral-900">
          Taking you to the secure payment page.
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          If nothing happens,{" "}
          <a href={checkoutUrl} className="font-semibold text-[#7B1113] underline">
            continue to payment
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function TimeoutPanel() {
  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm sm:p-8"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-amber-700" />
      <div>
        <p className="text-base font-bold text-amber-950">
          We are confirming your payment. Do not pay again.
        </p>
        <p className="mt-1 text-sm text-amber-900">
          Check{" "}
          <Link to="/account" className="font-semibold underline">
            Billing &amp; Payments
          </Link>{" "}
          in a few minutes to see whether it went through.
        </p>
      </div>
    </div>
  );
}

// ---- The results ----

function SuccessView({
  payment,
  balance,
  client,
}: {
  payment: PaymentDetail;
  /** What the student owes now, from a fresh GET /student/account; null until it arrives. */
  balance: string | null;
  client: PaymentsClient;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const receipt = useReceiptDownload(client);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex flex-col items-center text-center">
        <CheckCircle2 aria-hidden="true" className="size-16 text-emerald-600" />
        <h2
          ref={heading}
          tabIndex={-1}
          className="mt-4 text-2xl font-bold text-emerald-600 focus:outline-none sm:text-3xl"
        >
          Payment Successful
        </h2>
        <p className="mt-2 max-w-md text-sm text-neutral-600">
          Your account has been updated and confirmation was sent by email.
        </p>
      </div>

      <section className={CARD} aria-labelledby="payment-summary-heading">
        <h3 id="payment-summary-heading" className="mb-5 text-xl font-bold text-neutral-900">
          Payment Details
        </h3>
        <dl>
          <Row label="Reference Number">
            <span className="font-mono break-all">{payment.reference ?? "Not issued"}</span>
          </Row>
          {payment.receiptNumber !== null && (
            <Row label="Receipt Number">
              <span className="font-mono break-all">{payment.receiptNumber}</span>
            </Row>
          )}
          <Row label="Date & Time">
            {payment.paidAt === null ? "Not available" : formatTimestamp(payment.paidAt)}
          </Row>
          {balance !== null && <Row label="New Balance">{formatPesoAmount(balance)}</Row>}
        </dl>
        <Divider />
        <TotalRow label="Total Amount Paid" amount={payment.amount} />

        {receipt.isError && (
          <p role="alert" className="mt-5 text-sm font-medium text-red-700">
            We couldn&apos;t download your receipt. {errorMessage(receipt.error)}
          </p>
        )}

        <div className={ACTIONS}>
          {/* A button, not a link: the receipt needs the student's access token to fetch. */}
          <button
            type="button"
            onClick={() => receipt.mutate({ id: payment.id, receiptNumber: payment.receiptNumber })}
            disabled={receipt.isPending}
            className={PRIMARY_BUTTON}
          >
            {receipt.isPending ? "Preparing receipt…" : "Download Receipt"}
          </button>
          <BackLink className={SECONDARY_BUTTON} />
        </div>
      </section>
    </div>
  );
}

function FailedView({
  failure,
  totalDue,
  onTryAgain,
}: {
  failure: FailureView;
  totalDue: string;
  onTryAgain: () => void;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex flex-col items-center text-center">
        <AlertCircle aria-hidden="true" className="size-16 text-red-600" />
        <h2
          ref={heading}
          tabIndex={-1}
          className="mt-4 text-2xl font-bold text-red-600 focus:outline-none sm:text-3xl"
        >
          Payment Failed
        </h2>
        <p className="mt-2 max-w-md text-sm text-neutral-600">
          No payment was completed and your balance remains unchanged. You can try again.
        </p>
      </div>

      <section className={CARD} aria-labelledby="payment-summary-heading">
        <h3 id="payment-summary-heading" className="mb-5 text-xl font-bold text-neutral-900">
          Payment Details
        </h3>
        <dl>
          <Row label="Reference Number">
            <span className="font-mono break-all">{failure.reference ?? "Not issued"}</span>
          </Row>
          <Row label="Date & Time">{formatTimestamp(failure.occurredAt)}</Row>
          <Row label="Status">
            <span className="font-semibold text-red-700">Failed</span>
          </Row>
          <Row label="Reason">{failure.reason ?? "The payment was not completed."}</Row>
        </dl>
        <Divider />
        <TotalRow label="Total Amount Due" amount={totalDue} />

        <div className={ACTIONS}>
          <button type="button" onClick={onTryAgain} className={PRIMARY_BUTTON}>
            Try again
          </button>
          <BackLink className={SECONDARY_BUTTON} />
        </div>
      </section>
    </div>
  );
}

// ---- The page ----

/** One payment attempt on a loaded account. Remounted (a new attempt) when the source changes. */
function PayFlow({
  account,
  client,
  source,
  entry,
  preview,
}: {
  account: StudentAccount;
  client: PaymentsClient;
  source: string;
  entry: PayEntry;
  /** A preview has no gateway page to visit: the student "comes back" at once. */
  preview: boolean;
}) {
  const attempt = usePayAttempt(
    client,
    source,
    preview ? { entry, redirect: () => false } : { entry },
  );
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const { view } = attempt;

  // The status call has no balance. Once the payment is PAID, read the account again for what
  // the student owes now.
  const paid = view.kind === "success";
  useEffect(() => {
    if (!paid) return;
    let live = true;
    queryClient
      .fetchQuery({
        queryKey: payKeys.account(source),
        queryFn: () => client.account(),
        staleTime: 0,
      })
      .then((fresh) => {
        if (live) setBalance(fresh.netPayable);
      })
      .catch(() => {
        // The row simply stays out; the payment itself is already confirmed.
      });
    return () => {
      live = false;
    };
  }, [paid, queryClient, source, client]);

  if (view.kind === "success") {
    return <SuccessView payment={view.payment} balance={balance} client={client} />;
  }
  if (view.kind === "failed") {
    return (
      <FailedView
        failure={view.failure}
        totalDue={account.netPayable}
        onTryAgain={attempt.tryAgain}
      />
    );
  }

  const locked =
    view.kind === "in-progress" || view.kind === "timeout" || view.kind === "redirecting";
  const banner =
    view.kind === "in-progress" ? (
      <InProgressPanel />
    ) : view.kind === "timeout" ? (
      <TimeoutPanel />
    ) : view.kind === "redirecting" ? (
      <RedirectPanel checkoutUrl={view.checkoutUrl} />
    ) : null;

  return (
    <PaymentForm
      account={account}
      attempt={attempt}
      typed={typed}
      onTyped={setTyped}
      locked={locked}
      banner={banner}
    />
  );
}

/**
 * How the page was opened: fresh, or back from the gateway at one of the API's return URLs.
 * On the success address the payment is the one the address names (`?payment_id=`), or else the
 * one remembered before the trip.
 */
function entryFor(returned: "success" | "cancel" | undefined, search: unknown): PayEntry {
  if (returned === "cancel") return { kind: "cancelled" };
  if (returned === "success") {
    const paymentId = paymentIdFromSearch(search) ?? readPendingPayment();
    return paymentId === null ? { kind: "returned-unknown" } : { kind: "returned", paymentId };
  }
  return { kind: "new" };
}

/**
 * US-FIN-002: settle the outstanding balance. Mounted at /account/pay, and, with `returned`, at
 * the gateway's return addresses /payments/success and /payments/cancel.
 */
export function PayPage({ returned }: { returned?: "success" | "cancel" } = {}) {
  // A preview scenario is a stand-in for the API while there is no gateway. With none set, this
  // is the live client and nothing below changes.
  const [scenario, setScenario] = useState<PreviewScenario | null>(initialPreview);
  const search = useLocation({ select: (location) => location.search });
  const [entry] = useState(() => entryFor(returned, search));
  const client = useMemo(
    () => (scenario === null ? livePaymentsClient : previewPaymentsClient(scenario)),
    [scenario],
  );
  const account = usePayAccount(client, scenario ?? "live", previewAllowed());

  // Dev only: with no API to answer, fall back to the preview instead of an empty page.
  if (scenario === null && account.isError && previewFallback(account.error)) {
    setScenario("success");
  }

  return (
    <DashboardLayout>
      <div className="min-w-0 px-4 py-8 sm:px-8">
        <div className="max-w-6xl">
          <nav aria-label="Breadcrumb">
            <ol className="mb-3 flex items-center gap-1.5 text-xs text-neutral-500">
              <li>Finance</li>
              <li aria-hidden="true">&gt;</li>
              <li>
                <Link to="/account" className="hover:underline">
                  Billing &amp; Payments
                </Link>
              </li>
              <li aria-hidden="true">&gt;</li>
              <li aria-current="page" className="font-semibold text-neutral-800">
                Make Payment
              </li>
            </ol>
          </nav>

          <h1 className="text-3xl font-bold tracking-tight text-[#7B1113] sm:text-4xl">
            Make Payment
          </h1>
          <p className="mt-1.5 mb-8 text-sm text-neutral-600">
            Settle your outstanding balance securely.
          </p>

          {scenario !== null && <PreviewBar scenario={scenario} onChange={setScenario} />}

          {account.isPending && <Loading />}
          {account.isError && (
            <LoadError error={account.error} onRetry={() => void account.refetch()} />
          )}
          {account.data && (
            <PayFlow
              key={scenario ?? "live"}
              source={scenario ?? "live"}
              account={account.data}
              client={client}
              entry={scenario === null ? entry : { kind: "new" }}
              preview={scenario !== null}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

/** The gateway's success address: the student paid, or thinks so. Ask how it ended. */
export function PaySuccessReturn() {
  return <PayPage returned="success" />;
}

/** The gateway's cancel address: the student left without paying. */
export function PayCancelReturn() {
  return <PayPage returned="cancel" />;
}
