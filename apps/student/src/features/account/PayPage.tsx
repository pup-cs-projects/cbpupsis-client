import { Link } from "@tanstack/react-router";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  PAYMENT_METHODS,
  type PaymentDetail,
  type PaymentMethod,
  type StudentAccount,
} from "@cbpupsis/shared/account";
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
  useReceiptDownload,
  usePayAccount,
  usePayAttempt,
  type FailureView,
  type PaymentsClient,
} from "./usePayment";

// US-FIN-002: pay the balance online. Every peso figure below is the API's text, shown through
// formatPesoAmount (two decimals). Nothing is added, subtracted, or compared as a number.

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

const METHOD_LABEL: Record<PaymentMethod, string> = {
  EWALLET: "E-Wallet",
  BANK_TRANSFER: "Bank Transfer",
};

/** One line under each method card: which channels it covers. */
const METHOD_HINT: Record<PaymentMethod, string> = {
  EWALLET: "GCash, Maya, GrabPay",
  BANK_TRANSFER: "InstaPay / PESONet online banking",
};

/** A fee the API did not send is a fee it did not charge. */
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

function MethodCard({
  method,
  onChange,
  disabled,
}: {
  method: PaymentMethod;
  onChange: (next: PaymentMethod) => void;
  disabled: boolean;
}) {
  return (
    <section className={PANEL}>
      <h2 id="payment-method-heading" className="mb-4 text-xl font-bold text-neutral-900">
        Payment Method
      </h2>
      <div
        role="radiogroup"
        aria-labelledby="payment-method-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        {PAYMENT_METHODS.map((option) => {
          const selected = option === method;
          const hintId = `payment-method-hint-${option}`;
          return (
            <label
              key={option}
              className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-3 text-center text-base transition-colors focus-within:ring-2 focus-within:ring-[#7B1113] focus-within:ring-offset-2 ${
                selected
                  ? "border-2 border-[#7B1113] bg-[#7B1113]/[0.03] font-semibold text-[#7B1113]"
                  : "border border-neutral-300 text-neutral-800 hover:border-neutral-400"
              } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="radio"
                name="payment-method"
                value={option}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(option)}
                aria-describedby={hintId}
                className="sr-only"
              />
              <span>{METHOD_LABEL[option]}</span>
              {/* Hidden from the radio's name (which stays "E-Wallet"); read as its description. */}
              <span id={hintId} aria-hidden="true" className="text-xs font-normal text-neutral-500">
                {METHOD_HINT[option]}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

/** What the student has chosen and typed. Kept above the form, so a retry finds it as it was. */
interface Choices {
  method: PaymentMethod;
  /** Null until the student edits it: the field then shows the API's balance as it is. */
  typed: string | null;
}

function PaymentForm({
  account,
  attempt,
  choices,
  onChoices,
  locked,
  banner,
}: {
  account: StudentAccount;
  attempt: ReturnType<typeof usePayAttempt>;
  choices: Choices;
  onChoices: (next: Choices) => void;
  /** True once a payment is on its way: the form can be read but not sent again. */
  locked: boolean;
  banner: ReactNode;
}) {
  const { view } = attempt;
  const { method, typed } = choices;
  const [formatError, setFormatError] = useState<string | null>(null);

  const amount = typed ?? account.netPayable;
  const submitting = view.kind === "submitting";
  const noBalance = isZeroAmount(account.netPayable);
  const totalDue = account.totalAmountDue ?? account.netPayable;
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
    void attempt.submit({ amount: text, method });
  }

  return (
    <>
      {banner}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <MethodCard
            method={method}
            onChange={(next) => onChoices({ ...choices, method: next })}
            disabled={disabled}
          />

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
                  onChoices({ ...choices, typed: event.target.value });
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
            <Row label="Processing Fee">{formatPesoAmount(account.processingFee ?? NONE)}</Row>
            <Row label="Late Fees">{formatPesoAmount(account.penaltyAmount ?? NONE)}</Row>
          </dl>
          <Divider />
          <TotalRow label="Total Amount Due" amount={totalDue} inColumn />

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

function TimeoutPanel({ paymentId }: { paymentId: string | null }) {
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
          {paymentId === null
            ? "Check Billing & Payments in a few minutes to see whether it went through."
            : "This page updates once the bank answers."}
        </p>
      </div>
    </div>
  );
}

// ---- The results ----

function SuccessView({
  payment,
  method,
  client,
}: {
  payment: PaymentDetail;
  method: PaymentMethod;
  client: PaymentsClient;
}) {
  const heading = useFocusOnMount<HTMLHeadingElement>();
  const receipt = useReceiptDownload(client);
  const paidVia = METHOD_LABEL[payment.method ?? method];
  const paid = payment.totalAmountPaid ?? payment.amount ?? NONE;

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
          <Row label="Paid via">{paidVia}</Row>
          <Row label="Date & Time">
            {payment.processedAt === null ? "Not available" : formatTimestamp(payment.processedAt)}
          </Row>
          {payment.newBalance !== null && (
            <Row label="New Balance">{formatPesoAmount(payment.newBalance)}</Row>
          )}
        </dl>
        <Divider />
        <dl>
          <Row label="Payment Amount">{formatPesoAmount(payment.amount ?? NONE)}</Row>
          <Row label="Processing Fee">{formatPesoAmount(payment.processingFee ?? NONE)}</Row>
          <Row label="Late Fees">{formatPesoAmount(payment.lateFees ?? NONE)}</Row>
        </dl>
        <Divider />
        <TotalRow label="Total Amount Paid" amount={paid} />

        {receipt.isError && (
          <p role="alert" className="mt-5 text-sm font-medium text-red-700">
            We couldn&apos;t download your receipt. {errorMessage(receipt.error)}
          </p>
        )}

        <div className={ACTIONS}>
          {/* A button, not a link: the receipt needs the student's access token to fetch. */}
          <button
            type="button"
            onClick={() => receipt.mutate({ id: payment.id, reference: payment.reference })}
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
          <Row label="Reason">{failure.reason ?? "The payment gateway gave no reason."}</Row>
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
}: {
  account: StudentAccount;
  client: PaymentsClient;
  source: string;
}) {
  const attempt = usePayAttempt(client, source);
  const [choices, setChoices] = useState<Choices>({ method: "EWALLET", typed: null });
  const { view } = attempt;
  const totalDue = account.totalAmountDue ?? account.netPayable;

  if (view.kind === "success") {
    // The method on the receipt is the API's; the chosen one is only a fallback label.
    return <SuccessView payment={view.payment} method={choices.method} client={client} />;
  }
  if (view.kind === "failed") {
    return <FailedView failure={view.failure} totalDue={totalDue} onTryAgain={attempt.tryAgain} />;
  }

  const locked = view.kind === "in-progress" || view.kind === "timeout";
  const banner =
    view.kind === "in-progress" ? (
      <InProgressPanel />
    ) : view.kind === "timeout" ? (
      <TimeoutPanel paymentId={view.paymentId} />
    ) : null;

  return (
    <PaymentForm
      account={account}
      attempt={attempt}
      choices={choices}
      onChoices={setChoices}
      locked={locked}
      banner={banner}
    />
  );
}

/** US-FIN-002: settle the outstanding balance. */
export function PayPage() {
  // A preview scenario is a stand-in for the API while it is not deployed. With none set, this
  // is the live client and nothing below changes.
  const [scenario, setScenario] = useState<PreviewScenario | null>(initialPreview);
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
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
