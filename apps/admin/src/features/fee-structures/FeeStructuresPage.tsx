import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import {
  FEE_CODES,
  FEE_ERROR,
  formatHundredths,
  installmentTotal,
  isFeeAmount,
  percentHundredths,
  refusedDatePair,
  refusedFeeField,
  termLabel,
  type FeeCode,
  type FeeField,
  type FeeProgramOption,
  type FeeStructure,
  type FeeStructureInput,
} from "@cbpupsis/shared/fees";
import { Link } from "@tanstack/react-router";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useMe } from "../sign-in/useAdminAuth";
import { canManageFees } from "./access";
import { feeStructureDataSource, type FeeStructureDataSource } from "./dataSource";
import { useFeeStructure, useFeeStructureOptions, useSaveFeeStructure } from "./useFeeStructure";

const button =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-brand-border/40 bg-white px-4 py-2 text-sm font-semibold hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  button + " border-brand-maroon! bg-brand-maroon! text-white hover:bg-brand-maroon-dark!";
const card = "border-brand-border/25 min-w-0 rounded-2xl border bg-white p-5 shadow-sm sm:p-6";
const input =
  "border-brand-input-border text-brand-input-text min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm aria-[invalid=true]:border-brand-maroon";
const legend = "text-brand-maroon text-base font-bold";
const fieldError = "text-brand-maroon mt-1 text-xs font-semibold";

const IN_USE_MESSAGE =
  "Students were already assessed with these fees. Set up the change for a new term.";
const NOT_AVAILABLE_MESSAGE = "This page is not available to your role.";
const AMOUNT_HINT = "Enter 0 or more, with up to two decimals.";

const FEE_LABELS: Record<FeeCode, string> = {
  TUITION: "Tuition",
  REGISTRATION: "Registration fee",
  LAB: "Laboratory fee",
  MISC: "Miscellaneous fee",
};

/** The fixed fee fields and the subsidy code each one is billed under. */
const FIXED_FEES: { field: FeeField; code: FeeCode }[] = [
  { field: "registrationFee", code: "REGISTRATION" },
  { field: "labFee", code: "LAB" },
  { field: "miscFee", code: "MISC" },
];

const FIELD_LABELS: Record<FeeField, string> = {
  tuitionPerUnit: "Default tuition per unit (PHP)",
  registrationFee: "Registration fee (PHP)",
  labFee: "Laboratory fee (PHP)",
  miscFee: "Miscellaneous fee (PHP)",
  lateFeeRate: "Late penalty rate",
};

export function FeeStructuresPage({
  dataSource = feeStructureDataSource,
}: {
  dataSource?: FeeStructureDataSource;
}) {
  const me = useMe();
  const allowed = canManageFees(me.data?.position);
  const options = useFeeStructureOptions(dataSource, me.data?.id, me.isSuccess && allowed);
  const [pickedTerm, setPickedTerm] = useState<string | null>(null);
  // The current term is chosen until Finance picks another one.
  const termId = pickedTerm ?? options.data?.terms.find((term) => term.isCurrent)?.id ?? "";
  const query = useFeeStructure(dataSource, me.data?.id, termId, me.isSuccess && allowed);
  const forbidden =
    (query.error instanceof ApiError && query.error.status === 403) ||
    (options.error instanceof ApiError && options.error.status === 403);
  const denied = (me.isSuccess && !allowed) || forbidden;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <nav
          aria-label="Breadcrumb"
          className="text-brand-muted flex min-h-11 flex-wrap items-center gap-2 text-xs"
        >
          <Link
            to="/dashboard"
            className="hover:text-brand-maroon inline-flex min-h-11 items-center rounded-sm"
          >
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span>Financial</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-brand-ink font-semibold">
            Fee structure
          </span>
        </nav>
        <header>
          <h1 className="text-brand-maroon text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
            Fee structure
          </h1>
          <p className="text-brand-muted mt-3 max-w-2xl text-sm leading-relaxed">
            Set a term&apos;s tuition per unit, fixed fees, free tuition coverage, late penalty, and
            installments. Assessments for the term use what you save here.
          </p>
        </header>

        {denied ? (
          <section className={card}>
            <p role="alert">{NOT_AVAILABLE_MESSAGE}</p>
            <Link to="/dashboard" className={button + " mt-4"}>
              Back to dashboard
            </Link>
          </section>
        ) : me.isPending ? (
          <p role="status">Checking access…</p>
        ) : me.isError ? (
          <div role="alert" className={card}>
            <p>{errorMessage(me.error)}</p>
            <button type="button" className={button + " mt-4"} onClick={() => void me.refetch()}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <section className={card} aria-labelledby="term-heading">
              <h2 id="term-heading" className={legend}>
                Academic term
              </h2>
              {options.isPending ? (
                <p role="status" className="mt-4 text-sm">
                  Loading terms and programs…
                </p>
              ) : options.isError ? (
                <div role="alert" className="mt-4">
                  <p>{errorMessage(options.error)}</p>
                  {options.error instanceof ApiError && options.error.requestId && (
                    <p className="text-brand-muted mt-2 text-xs">
                      Request ID: {options.error.requestId}
                    </p>
                  )}
                  <button
                    type="button"
                    className={button + " mt-4"}
                    disabled={options.isFetching}
                    onClick={() => void options.refetch()}
                  >
                    Retry loading terms
                  </button>
                </div>
              ) : options.data.terms.length === 0 ? (
                <p className="mt-4 text-sm">No academic terms exist yet.</p>
              ) : (
                <div className="mt-4 max-w-md min-w-0">
                  <label htmlFor="fee-term" className="text-sm font-medium">
                    Term <span aria-hidden="true">*</span>
                  </label>
                  <select
                    id="fee-term"
                    className={input + " mt-2"}
                    value={termId}
                    required
                    onChange={(event) => setPickedTerm(event.target.value)}
                  >
                    {termId === "" && (
                      <option value="" disabled>
                        Choose a term
                      </option>
                    )}
                    {options.data.terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {termLabel(term)}
                        {term.isCurrent ? " (current)" : ""}
                        {term.hasFeeStructure ? "" : ", no fees saved"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {options.isSuccess && options.data.terms.length > 0 && termId === "" ? (
              <p className="text-brand-muted text-sm">
                Choose a term to see and edit its fee structure.
              </p>
            ) : termId === "" ? null : query.isPending ? (
              <p role="status">Loading the fee structure…</p>
            ) : query.isError ? (
              <div role="alert" className={card}>
                <p>
                  {query.error instanceof ApiError && query.error.status === 404
                    ? "This academic term no longer exists. Choose another term."
                    : errorMessage(query.error)}
                </p>
                {query.error instanceof ApiError && query.error.requestId && (
                  <p className="text-brand-muted mt-2 text-xs">
                    Request ID: {query.error.requestId}
                  </p>
                )}
                <button
                  type="button"
                  className={button + " mt-4"}
                  disabled={query.isFetching}
                  onClick={() => void query.refetch()}
                >
                  Retry loading fees
                </button>
              </div>
            ) : (
              <FeeStructureForm
                key={termId}
                termId={termId}
                initial={query.data}
                programOptions={options.data?.programs ?? []}
                owner={me.data?.id}
                source={dataSource}
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

interface ProgramDraft {
  key: number;
  programId: string;
  tuitionPerUnit: string;
}

interface InstallmentDraft {
  key: number;
  percentage: string;
  dueDate: string;
}

type Amounts = Record<FeeField, string>;

function isBlank(data: FeeStructure): boolean {
  return (
    [data.tuitionPerUnit, data.registrationFee, data.labFee, data.miscFee, data.lateFeeRate].every(
      (value) => Number(value) === 0,
    ) &&
    data.programTuitionRates.length === 0 &&
    data.installments.length === 0 &&
    data.dueDate === null &&
    data.subsidyCoveredFees.length === 0
  );
}

function FeeStructureForm({
  termId,
  initial,
  programOptions,
  owner,
  source,
}: {
  termId: string;
  initial: FeeStructure;
  programOptions: FeeProgramOption[];
  owner: string | undefined;
  source: FeeStructureDataSource;
}) {
  const id = useId();
  const save = useSaveFeeStructure(source, owner, termId);
  const nextKey = useRef(initial.programTuitionRates.length + initial.installments.length);
  const [amounts, setAmounts] = useState<Amounts>({
    tuitionPerUnit: initial.tuitionPerUnit,
    registrationFee: initial.registrationFee,
    labFee: initial.labFee,
    miscFee: initial.miscFee,
    lateFeeRate: initial.lateFeeRate,
  });
  const [programs, setPrograms] = useState<ProgramDraft[]>(
    initial.programTuitionRates.map((rate, index) => ({ key: index, ...rate })),
  );
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [covered, setCovered] = useState<Set<string>>(
    () => new Set(initial.subsidyCoveredFees.map((code) => code.toUpperCase())),
  );
  const [installments, setInstallments] = useState<InstallmentDraft[]>(
    initial.installments.map((item, index) => ({
      key: initial.programTuitionRates.length + index,
      percentage: item.percentage,
      dueDate: item.dueDate,
    })),
  );
  const [programToAdd, setProgramToAdd] = useState("");
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [inUse, setInUse] = useState(false);

  const programById = new Map(programOptions.map((program) => [program.id, program]));
  const listed = new Set(programs.map((program) => program.programId));
  const addable = programOptions.filter((program) => !listed.has(program.id));

  /** The program a row names, as a person reads it, never a raw ID when the program is known. */
  function programName(programId: string): { code: string; name: string } {
    const known = programById.get(programId);
    return known
      ? { code: known.code, name: known.name }
      : { code: "Inactive program", name: programId };
  }

  const total = installmentTotal(installments.map((item) => item.percentage));
  const totalIsExact = installments.length === 0 || total === 10_000;
  const refusedField = refusedFeeField(save.error);
  const datePair = refusedDatePair(save.error);
  const sumRefused = save.error instanceof ApiError && save.error.code === FEE_ERROR.installmentSum;
  const otherError =
    save.error && !refusedField && !datePair && !sumRefused && !inUse ? save.error : null;

  function fieldMessage(field: FeeField): string | undefined {
    if (clientErrors[field]) return clientErrors[field];
    if (refusedField === field) return errorMessage(save.error);
    return undefined;
  }

  function takeKey() {
    nextKey.current += 1;
    return nextKey.current;
  }

  function edit() {
    setSaved(false);
    if (save.error && !inUse) save.reset();
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const field of Object.keys(amounts) as FeeField[]) {
      if (!isFeeAmount(amounts[field])) errors[field] = AMOUNT_HINT;
    }
    for (const program of programs) {
      if (!program.programId.trim()) errors[`program-${program.key}-id`] = "Choose a program.";
      if (!isFeeAmount(program.tuitionPerUnit)) errors[`program-${program.key}-rate`] = AMOUNT_HINT;
    }
    for (const item of installments) {
      if (percentHundredths(item.percentage) === null)
        errors[`installment-${item.key}-percentage`] =
          "Enter a percentage from 0 to 100, with up to two decimals.";
      if (!item.dueDate) errors[`installment-${item.key}-date`] = "Enter the due date.";
    }
    return errors;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending || inUse || !totalIsExact) return;
    const errors = validate();
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const body: FeeStructureInput = {
      tuitionPerUnit: amounts.tuitionPerUnit.trim(),
      registrationFee: amounts.registrationFee.trim(),
      labFee: amounts.labFee.trim(),
      miscFee: amounts.miscFee.trim(),
      lateFeeRate: amounts.lateFeeRate.trim(),
      programTuitionRates: programs.map((program) => ({
        programId: program.programId.trim(),
        tuitionPerUnit: program.tuitionPerUnit.trim(),
      })),
      dueDate: dueDate || null,
      subsidyCoveredFees: [...covered],
      installments: installments.map((item, index) => ({
        installmentNumber: index + 1,
        percentage: item.percentage.trim(),
        dueDate: item.dueDate,
      })),
    };
    setSaved(false);
    save.mutate(body, {
      onSuccess: () => setSaved(true),
      onError: (error) => {
        if (error instanceof ApiError && error.code === FEE_ERROR.inUse) setInUse(true);
      },
    });
  }

  function amountField(field: FeeField, hint?: string) {
    const message = fieldMessage(field);
    const inputId = `${id}-${field}`;
    return (
      <div className="min-w-0">
        <label htmlFor={inputId} className="text-sm font-medium">
          {FIELD_LABELS[field]} <span aria-hidden="true">*</span>
        </label>
        <input
          id={inputId}
          className={input + " mt-2"}
          inputMode="decimal"
          required
          autoComplete="off"
          value={amounts[field]}
          disabled={inUse}
          aria-invalid={message ? true : undefined}
          aria-describedby={`${inputId}-error${hint ? ` ${inputId}-hint` : ""}`}
          onChange={(event) => {
            edit();
            setAmounts({ ...amounts, [field]: event.target.value });
          }}
        />
        {hint && (
          <p id={`${inputId}-hint`} className="text-brand-muted mt-1 text-xs">
            {hint}
          </p>
        )}
        <p id={`${inputId}-error`} className={fieldError}>
          {message}
        </p>
      </div>
    );
  }

  function coverage(code: FeeCode) {
    const checkboxId = `${id}-covered-${code}`;
    return (
      <div className="mt-2 flex min-h-11 items-center gap-3">
        <input
          id={checkboxId}
          type="checkbox"
          className="accent-brand-maroon size-5"
          checked={covered.has(code)}
          disabled={inUse}
          onChange={(event) => {
            edit();
            const next = new Set(covered);
            if (event.target.checked) next.add(code);
            else next.delete(code);
            setCovered(next);
          }}
        />
        <label htmlFor={checkboxId} className="text-sm">
          Covered by free tuition<span className="sr-only"> ({FEE_LABELS[code]})</span>
        </label>
      </div>
    );
  }

  function pairMessage(index: number): string | undefined {
    if (!datePair || index === 0) return undefined;
    const previous = installments[index - 1];
    const current = installments[index];
    if (previous?.dueDate !== datePair.previous || current?.dueDate !== datePair.current)
      return undefined;
    return `Installment ${index + 1} is due ${datePair.current}, before installment ${index} on ${datePair.previous}. Put the due dates in order.`;
  }

  const totalText =
    total === null
      ? "Total: enter a valid percentage for every installment."
      : total === 10_000
        ? "Total: 100.00%. The installments add up to exactly 100%."
        : total < 10_000
          ? `Total: ${formatHundredths(total)}%. ${formatHundredths(10_000 - total)}% short of 100%.`
          : `Total: ${formatHundredths(total)}%. ${formatHundredths(total - 10_000)}% over 100%.`;
  const coveredNames = FEE_CODES.filter((code) => covered.has(code)).map(
    (code) => FEE_LABELS[code],
  );

  return (
    <form noValidate onSubmit={submit} className="space-y-6" aria-label="Fee structure">
      {isBlank(initial) && (
        <p role="status" className={card}>
          No fees are saved for this term yet. Enter them below, then save.
        </p>
      )}
      {inUse && (
        <p role="alert" className={card + " border-brand-maroon! text-brand-maroon font-semibold"}>
          {IN_USE_MESSAGE}
        </p>
      )}

      <Group title="Tuition per program">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            {amountField("tuitionPerUnit", "Used for any program without its own rate below.")}
            {coverage("TUITION")}
          </div>
        </div>
        <ul className="mt-4 space-y-4" aria-label="Program tuition rates">
          {programs.map((program) => {
            const idError = clientErrors[`program-${program.key}-id`];
            const rateError = clientErrors[`program-${program.key}-rate`];
            const base = `${id}-program-${program.key}`;
            const named = programName(program.programId);
            return (
              <li
                key={program.key}
                className="border-brand-border/25 grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-start"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">Program</p>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">{named.code}</span>{" "}
                    <span className="text-brand-muted break-words">{named.name}</span>
                  </p>
                  <p className={fieldError}>{idError}</p>
                </div>
                <div className="min-w-0">
                  <label htmlFor={`${base}-rate`} className="text-sm font-medium">
                    {named.code} tuition per unit (PHP) <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`${base}-rate`}
                    className={input + " mt-2"}
                    inputMode="decimal"
                    required
                    autoComplete="off"
                    value={program.tuitionPerUnit}
                    disabled={inUse}
                    aria-invalid={rateError ? true : undefined}
                    aria-describedby={`${base}-rate-error`}
                    onChange={(event) => {
                      edit();
                      setPrograms(
                        programs.map((item) =>
                          item.key === program.key
                            ? { ...item, tuitionPerUnit: event.target.value }
                            : item,
                        ),
                      );
                    }}
                  />
                  <p id={`${base}-rate-error`} className={fieldError}>
                    {rateError}
                  </p>
                </div>
                <button
                  type="button"
                  className={button + " sm:mt-7"}
                  disabled={inUse}
                  onClick={() => {
                    edit();
                    setPrograms(programs.filter((item) => item.key !== program.key));
                  }}
                >
                  Remove<span className="sr-only"> {named.code} rate</span>
                </button>
              </li>
            );
          })}
        </ul>
        {addable.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <label htmlFor={`${id}-program-add`} className="text-sm font-medium">
                Program to add
              </label>
              <select
                id={`${id}-program-add`}
                className={input + " mt-2"}
                value={programToAdd}
                disabled={inUse}
                onChange={(event) => setProgramToAdd(event.target.value)}
              >
                <option value="">Choose a program</option>
                {addable.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.code}: {program.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={button}
              disabled={inUse || programToAdd === ""}
              onClick={() => {
                edit();
                setPrograms([
                  ...programs,
                  { key: takeKey(), programId: programToAdd, tuitionPerUnit: "" },
                ]);
                setProgramToAdd("");
              }}
            >
              Add program rate
            </button>
          </div>
        ) : (
          programOptions.length > 0 && (
            <p className="text-brand-muted mt-4 text-sm">Every active program has its own rate.</p>
          )
        )}
      </Group>

      <Group title="Fixed fees">
        <div className="grid gap-5 sm:grid-cols-3">
          {FIXED_FEES.map(({ field, code }) => (
            <div key={field} className="min-w-0">
              {amountField(field)}
              {coverage(code)}
            </div>
          ))}
        </div>
      </Group>

      <Group title="Free tuition coverage">
        <p className="text-sm" aria-live="polite">
          {coveredNames.length > 0
            ? `Free tuition (RA 10931) covers: ${coveredNames.join(", ")}.`
            : "No fee is marked as covered by free tuition."}
        </p>
        <p className="text-brand-muted mt-1 text-xs">
          Qualified students are not billed for the fees marked &quot;Covered by free tuition&quot;.
          Late penalties are never covered.
        </p>
      </Group>

      <Group title="Due date and late penalty">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor={`${id}-due-date`} className="text-sm font-medium">
              Payment due date
            </label>
            <input
              id={`${id}-due-date`}
              type="date"
              className={input + " mt-2"}
              value={dueDate}
              disabled={inUse}
              onChange={(event) => {
                edit();
                setDueDate(event.target.value);
              }}
            />
          </div>
          {amountField("lateFeeRate")}
        </div>
      </Group>

      <Group title="Installments">
        <ol className="space-y-4" aria-label="Installment schedule">
          {installments.map((item, index) => {
            const base = `${id}-installment-${item.key}`;
            const percentError = clientErrors[`installment-${item.key}-percentage`];
            const dateError = clientErrors[`installment-${item.key}-date`] ?? pairMessage(index);
            return (
              <li
                key={item.key}
                className="border-brand-border/25 grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
              >
                <div className="min-w-0">
                  <label htmlFor={`${base}-percentage`} className="text-sm font-medium">
                    Installment {index + 1} share (%) <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`${base}-percentage`}
                    className={input + " mt-2"}
                    inputMode="decimal"
                    required
                    autoComplete="off"
                    value={item.percentage}
                    disabled={inUse}
                    aria-invalid={percentError ? true : undefined}
                    aria-describedby={`${base}-percentage-error`}
                    onChange={(event) => {
                      edit();
                      setInstallments(
                        installments.map((row) =>
                          row.key === item.key ? { ...row, percentage: event.target.value } : row,
                        ),
                      );
                    }}
                  />
                  <p id={`${base}-percentage-error`} className={fieldError}>
                    {percentError}
                  </p>
                </div>
                <div className="min-w-0">
                  <label htmlFor={`${base}-date`} className="text-sm font-medium">
                    Installment {index + 1} due date <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id={`${base}-date`}
                    type="date"
                    className={input + " mt-2"}
                    required
                    value={item.dueDate}
                    disabled={inUse}
                    aria-invalid={dateError ? true : undefined}
                    aria-describedby={`${base}-date-error`}
                    onChange={(event) => {
                      edit();
                      setInstallments(
                        installments.map((row) =>
                          row.key === item.key ? { ...row, dueDate: event.target.value } : row,
                        ),
                      );
                    }}
                  />
                  <p id={`${base}-date-error`} className={fieldError}>
                    {dateError}
                  </p>
                </div>
                <button
                  type="button"
                  className={button + " sm:mt-7"}
                  disabled={inUse}
                  onClick={() => {
                    edit();
                    setInstallments(installments.filter((row) => row.key !== item.key));
                  }}
                >
                  Remove<span className="sr-only"> installment {index + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {installments.length === 0 && (
          <p className="text-brand-muted text-sm">
            No installments. Students pay the full amount by the due date.
          </p>
        )}
        <button
          type="button"
          className={button + " mt-4"}
          disabled={inUse}
          onClick={() => {
            edit();
            setInstallments([...installments, { key: takeKey(), percentage: "", dueDate: "" }]);
          }}
        >
          Add installment
        </button>
        {installments.length > 0 && (
          <div className="mt-4">
            <p
              id={`${id}-installment-total`}
              aria-live="polite"
              className={
                "text-sm font-semibold " +
                (total === 10_000 ? "text-brand-success" : "text-brand-ink")
              }
            >
              {totalText}
            </p>
            <p className={fieldError} role={sumRefused ? "alert" : undefined}>
              {sumRefused ? errorMessage(save.error) : null}
            </p>
          </div>
        )}
      </Group>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {saved && (
          <p role="status" className="text-brand-success text-sm font-semibold">
            Fee structure saved for this term.
          </p>
        )}
        {otherError && (
          <div role="alert" className="text-brand-maroon text-sm">
            <p>{errorMessage(otherError)}</p>
            {otherError instanceof ApiError && otherError.requestId && (
              <p className="text-brand-muted mt-1 text-xs">Request ID: {otherError.requestId}</p>
            )}
          </div>
        )}
        {!totalIsExact && (
          <p id={`${id}-save-hint`} className="text-brand-muted text-sm">
            Save is available once the installments total exactly 100%.
          </p>
        )}
        <button
          type="submit"
          className={primary}
          disabled={save.isPending || inUse || !totalIsExact}
          aria-describedby={!totalIsExact ? `${id}-save-hint` : undefined}
        >
          {save.isPending ? "Saving…" : "Save fee structure"}
        </button>
      </div>
    </form>
  );
}

/** One titled group of the form; the heading names the group for screen readers. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className={card} aria-labelledby={headingId}>
      <h2 id={headingId} className={legend + " mb-4"}>
        {title}
      </h2>
      {children}
    </section>
  );
}
