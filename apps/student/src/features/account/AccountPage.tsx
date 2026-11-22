import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import { ApiError } from "@cbpupsis/shared/api";

import {
  isSettled,
  PAYMENT_OVERDUE,
  type StudentAccount,
  type StudentPayment,
} from "@cbpupsis/shared/account";

import "@cbpupsis/account/styles.css";
import { formatShortDate } from "../../lib/datetime";
import { formatPesoAmount, isPositiveAmount, isZeroAmount } from "../../lib/money";
import { DashboardLayout } from "../dashboard/DashboardLayout";
// import { billingSample } from "./sampleData"; // demo data, commented out: see useAccount.ts
import { useStudentAccount, useStudentPayments } from "./useAccount";

// Every amount below is the API's text, shown through formatPesoAmount. Nothing is added,
// subtracted, or compared as a number here (AC-FIN-001.10).

const SECTION_HEADING = "text-xl font-bold text-neutral-900 mt-10 mb-4";
const TABLE_CARD = "bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden";
const TABLE_HEAD = "bg-[#7B1113] text-white text-xs font-semibold tracking-wider uppercase";
const HEAD_CELL = "px-4 py-3 text-left font-semibold whitespace-nowrap sm:px-6";
// Every cell is left-aligned; amounts use tabular figures so their digits line up.
const CELL_BASE = "px-4 py-4 text-left align-middle text-neutral-800 sm:px-6";
const CELL = `${CELL_BASE} text-sm`;
const EMPTY = "px-6 py-10 text-center text-sm text-neutral-600";

function Loading() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading your billing statement
      </p>
      <div aria-hidden="true" className="space-y-6">
        <div className="h-56 animate-pulse rounded-2xl bg-neutral-200/60 motion-reduce:animate-none" />
        <div className="h-40 animate-pulse rounded-2xl bg-neutral-200/60 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** What went wrong, for a bug report: the HTTP status, the API's code, and its request id. */
function errorReference(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const parts = [error.status > 0 ? `Error ${error.status}` : "No response from the server"];
  if (error.code) parts.push(error.code);
  if (error.requestId) parts.push(`Reference ${error.requestId}`);
  return parts.join(" · ");
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const reference = errorReference(error);
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-10 text-center shadow-sm">
      <p role="alert" className="font-semibold text-neutral-900">
        We couldn&apos;t load your billing statement. Check your connection and try again.
      </p>
      {reference && <p className="mt-2 text-sm break-words text-neutral-600">{reference}</p>}
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 h-10 min-w-[140px] rounded-lg bg-[#7B1113] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#630e10]"
      >
        Retry
      </button>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-neutral-600">{label}</dt>
      <dd className="font-medium text-neutral-800 tabular-nums">{value}</dd>
    </>
  );
}

function OverdueAlert({ account }: { account: StudentAccount }) {
  const { overdueAmount, penaltyAmount } = account;
  const detail =
    overdueAmount === null
      ? ""
      : `: ${formatPesoAmount(overdueAmount)}${
          penaltyAmount === null ? "" : ` (Penalty: ${formatPesoAmount(penaltyAmount)})`
        }`;
  return (
    <div
      role="alert"
      className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 break-words">
        {`Overdue payment${detail} — Pay now to lift the hold on enrollment.`}
      </p>
    </div>
  );
}

function GoodStanding() {
  return (
    <div
      role="status"
      className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
    >
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 break-words">
        No Outstanding Balance — Your account is in good standing.
      </p>
    </div>
  );
}

function AccountStatus({ account }: { account: StudentAccount }) {
  const navigate = useNavigate();
  const overdue = account.paymentStatus === PAYMENT_OVERDUE;
  const owes = isPositiveAmount(account.netPayable);
  // The API sends "0.00" when there is no subsidy (AC-FIN-001.6): then there is no line for it.
  const hasSubsidy = !isZeroAmount(account.subsidyApplied);

  return (
    <section aria-labelledby="account-status-heading">
      <h2 id="account-status-heading" className="mb-4 text-xl font-bold text-neutral-900">
        Account Status
      </h2>
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
        <dl>
          <dt className="text-sm font-semibold tracking-wider text-neutral-600 uppercase">
            Net Payable
          </dt>
          <dd className="my-2 text-4xl font-bold tracking-tight text-[#7B1113] tabular-nums sm:text-5xl">
            {formatPesoAmount(account.netPayable)}
          </dd>
        </dl>

        <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-1 text-sm">
          <Figure label="Amount Assessed" value={formatPesoAmount(account.amountAssessed)} />
          {hasSubsidy && (
            <Figure label="Subsidy Applied" value={formatPesoAmount(account.subsidyApplied)} />
          )}
        </dl>

        {account.fheForfeited && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Paying status</p>
            {account.fheForfeitureReason !== null && (
              <p className="mt-1 break-words">{account.fheForfeitureReason}</p>
            )}
          </div>
        )}

        {overdue && <OverdueAlert account={account} />}
        {!overdue && !owes && <GoodStanding />}

        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center print:hidden">
          {owes && (
            <button
              type="button"
              onClick={() => void navigate({ to: "/account/pay" })}
              className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-xl bg-[#7B1113] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#630e10]"
            >
              Pay Now
            </button>
          )}
          {/* No invoice file exists yet; this prints the statement, which saves as a PDF. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
          >
            Download Invoice
          </button>
        </div>
      </div>
    </section>
  );
}

function Assessment({ account }: { account: StudentAccount }) {
  return (
    <div>
      <h2 id="assessment-heading" className={SECTION_HEADING}>
        Current Semester Assessment
      </h2>
      <div className={TABLE_CARD}>
        {account.lines.length === 0 ? (
          <p className={EMPTY}>No billing items for this semester yet.</p>
        ) : (
          // Keyboard users scroll a region that overflows; it only does at narrow widths.
          <div
            role="region"
            aria-labelledby="assessment-heading"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1)
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[600px] table-fixed border-collapse">
              <caption className="sr-only">Current semester assessment</caption>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th scope="col" className={`${HEAD_CELL} w-1/3`}>
                    Description
                  </th>
                  <th scope="col" className={`${HEAD_CELL} w-1/3`}>
                    Amount
                  </th>
                  <th scope="col" className={`${HEAD_CELL} w-1/3`}>
                    Coverage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {account.lines.map((line, index) => (
                  <tr key={`${index}-${line.description}`}>
                    <th scope="row" className={`${CELL} font-medium break-words`}>
                      {line.description}
                    </th>
                    <td className={`${CELL} tabular-nums`}>{formatPesoAmount(line.amount)}</td>
                    <td className={CELL}>
                      {line.coveredByFhe ? (
                        <span className="text-sm font-medium text-emerald-700">
                          Subsidized (Free Tuition)
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-700">Student Account</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** "SETTLED" as "Paid", "PENDING" as "Pending", any other status in its own words. Plain text. */
function StatusLabel({ status }: { status: string }) {
  if (status.toUpperCase() === "PAID") {
    return <span className="text-sm font-medium text-emerald-700">Paid</span>;
  }
  if (status.toUpperCase() === "PENDING") {
    return <span className="text-sm font-medium text-amber-700">Pending</span>;
  }
  const text = status.replaceAll("_", " ").toLowerCase();
  return (
    <span className="text-sm text-neutral-700">{text.charAt(0).toUpperCase() + text.slice(1)}</span>
  );
}

function PaymentRow({ payment }: { payment: StudentPayment }) {
  return (
    <tr>
      <td className={`${CELL} whitespace-nowrap`}>{formatShortDate(payment.paidAt)}</td>
      <td className={`${CELL} tabular-nums`}>{formatPesoAmount(payment.amount)}</td>
      <td className={`${CELL_BASE} font-mono text-xs break-all`}>{payment.reference}</td>
      <td className={CELL}>
        <StatusLabel status={payment.status} />
      </td>
      <td className={CELL}>
        {isSettled(payment) && payment.receiptUrl !== null && (
          <a
            href={payment.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Receipt for ${payment.reference}`}
            className="text-sm font-semibold text-[#7B1113] hover:underline"
          >
            Receipt
          </a>
        )}
      </td>
    </tr>
  );
}

function PaymentHistory({ payments }: { payments: StudentPayment[] }) {
  return (
    <div>
      <h2 id="payments-heading" className={SECTION_HEADING}>
        Payment History
      </h2>
      <div className={TABLE_CARD}>
        {payments.length === 0 ? (
          <p className={EMPTY}>No payment history yet.</p>
        ) : (
          <div
            role="region"
            aria-labelledby="payments-heading"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1)
            tabIndex={0}
            className="overflow-x-auto"
          >
            <table className="w-full min-w-[600px] table-fixed border-collapse">
              <caption className="sr-only">Payment history</caption>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th scope="col" className={`${HEAD_CELL} w-1/5`}>
                    Date
                  </th>
                  <th scope="col" className={`${HEAD_CELL} w-1/5`}>
                    Amount
                  </th>
                  <th scope="col" className={`${HEAD_CELL} w-1/5`}>
                    Reference
                  </th>
                  <th scope="col" className={`${HEAD_CELL} w-1/5`}>
                    Status
                  </th>
                  <th scope="col" className={`${HEAD_CELL} w-1/5`}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** US-FIN-001: the student's billing statement, assessment, and payment history. */
export function AccountPage() {
  const account = useStudentAccount();
  const payments = useStudentPayments();

  const retry = () => {
    if (account.isError) void account.refetch();
    if (payments.isError) void payments.refetch();
  };

  return (
    <DashboardLayout>
      {/* The header is the Academics pages' (My Schedule, Grades), class for class. */}
      <div className="min-w-0 space-y-6 px-4 py-8 sm:px-8">
        <nav aria-label="Breadcrumb">
          <ol className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <li>Finance</li>
            <li aria-hidden="true">&gt;</li>
            <li aria-current="page" className="text-brand-ink font-semibold">
              Billing &amp; Payments
            </li>
          </ol>
        </nav>

        <div>
          <h1 className="text-brand-crimson text-3xl font-bold tracking-tight sm:text-4xl">
            Billing &amp; Payments
          </h1>
          <p className="mt-1 mb-6 max-w-3xl text-sm leading-relaxed text-neutral-600">
            View your current semester billing assessment, subsidy coverage, and payment status.
          </p>
        </div>

        {/* Demo-data note, commented out with the demo data (see useAccount.ts):
        {billingSample() && (
          <p
            role="note"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            Local sample data ({billingSample()}). No real records are shown.
          </p>
        )}
        */}

        {(account.isPending || payments.isPending) && !account.isError && !payments.isError && (
          <Loading />
        )}

        {(account.isError || payments.isError) && (
          <LoadError error={account.error ?? payments.error} onRetry={retry} />
        )}

        {account.data !== undefined && payments.data && (
          <>
            {account.data ? (
              <>
                <AccountStatus account={account.data} />
                <Assessment account={account.data} />
              </>
            ) : (
              // The API has no billing account for this student yet (404): nothing is owed.
              <section aria-labelledby="account-status-heading">
                <h2 id="account-status-heading" className="mb-4 text-xl font-bold text-neutral-900">
                  Account Status
                </h2>
                <div className={TABLE_CARD}>
                  <p className={EMPTY}>No billing statement for this semester yet.</p>
                </div>
              </section>
            )}
            <PaymentHistory payments={payments.data} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
