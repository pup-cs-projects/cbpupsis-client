import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import * as parse from "../api/parse";
import type { components } from "../api/schema.gen";

type Schemas = components["schemas"];

/**
 * A term's fee structure as `GET /admin/fee-structures/{term_id}` returns it (FeeStructureRead).
 * Every amount and percentage is a decimal string, never a float (SRS 4.2).
 */
export interface FeeStructure {
  academicTermId: string;
  tuitionPerUnit: string;
  programTuitionRates: ProgramTuitionRate[];
  registrationFee: string;
  labFee: string;
  miscFee: string;
  lateFeeRate: string;
  /** ISO date (`YYYY-MM-DD`), or null when none is saved. */
  dueDate: string | null;
  /** Fee codes the free tuition subsidy covers (`TUITION`, `REGISTRATION`, `LAB`, `MISC`). */
  subsidyCoveredFees: string[];
  installments: FeeInstallment[];
}

export interface ProgramTuitionRate {
  programId: string;
  tuitionPerUnit: string;
}

export interface FeeInstallment {
  installmentNumber: number;
  percentage: string;
  /** ISO date (`YYYY-MM-DD`). */
  dueDate: string;
}

/** A term Finance can set fees for, as `GET /admin/fee-structures/options` lists it. */
export interface FeeTermOption {
  id: string;
  academicYear: string;
  semester: string;
  isCurrent: boolean;
  /** True when the term already has a saved fee structure. */
  hasFeeStructure: boolean;
}

/** An active program a per-program tuition rate can name. */
export interface FeeProgramOption {
  id: string;
  code: string;
  name: string;
}

/** The terms (current first, then newest) and active programs (by code) for the form. */
export interface FeeStructureOptions {
  terms: FeeTermOption[];
  programs: FeeProgramOption[];
}

const SEMESTER_NAMES: Record<string, string> = {
  "1": "First semester",
  first: "First semester",
  "first semester": "First semester",
  "2": "Second semester",
  second: "Second semester",
  "second semester": "Second semester",
  summer: "Summer",
  midyear: "Summer",
};

/** A term as a person reads it: `2026-2027 First semester`. */
export function termLabel(term: Pick<FeeTermOption, "academicYear" | "semester">): string {
  const raw = term.semester.trim().replace(/_/g, " ").toLowerCase();
  const known = SEMESTER_NAMES[raw];
  const semester = known ?? raw.charAt(0).toUpperCase() + raw.slice(1);
  return `${term.academicYear} ${semester}`.trim();
}

/** What `PUT /admin/fee-structures/{term_id}` saves: the read shape without the term id. */
export type FeeStructureInput = Omit<FeeStructure, "academicTermId">;

/** The fee lines an assessment bills, in the codes the API's subsidy coverage uses. */
export const FEE_CODES = ["TUITION", "REGISTRATION", "LAB", "MISC"] as const;
export type FeeCode = (typeof FEE_CODES)[number];

/** The refusal codes the fee structure endpoints answer with (ERROR-CODES.md). */
export const FEE_ERROR = {
  validation: "VALIDATION_ERROR",
  installmentSum: "INSTALLMENT_SUM_INVALID",
  installmentDateOrder: "INSTALLMENT_DATE_ORDER",
  inUse: "FEE_STRUCTURE_IN_USE",
} as const;

/**
 * The API names a refused field in snake case (`details.field`). These are the request fields
 * each name maps to. A negative program rate is also reported as `tuition_per_unit`.
 */
export const FEE_FIELD_BY_API_NAME = {
  tuition_per_unit: "tuitionPerUnit",
  registration_fee: "registrationFee",
  lab_fee: "labFee",
  misc_fee: "miscFee",
  late_fee_rate: "lateFeeRate",
} as const satisfies Record<string, keyof FeeStructureInput>;

export type FeeField = (typeof FEE_FIELD_BY_API_NAME)[keyof typeof FEE_FIELD_BY_API_NAME];

/** The field a 422 `VALIDATION_ERROR` names, or null when it names none this form has. */
export function refusedFeeField(error: unknown): FeeField | null {
  if (!(error instanceof ApiError) || error.code !== FEE_ERROR.validation) return null;
  const field = error.details?.field;
  if (typeof field !== "string") return null;
  return field in FEE_FIELD_BY_API_NAME
    ? FEE_FIELD_BY_API_NAME[field as keyof typeof FEE_FIELD_BY_API_NAME]
    : null;
}

/** The two due dates a 422 `INSTALLMENT_DATE_ORDER` names, earlier entry first. */
export function refusedDatePair(error: unknown): { previous: string; current: string } | null {
  if (!(error instanceof ApiError) || error.code !== FEE_ERROR.installmentDateOrder) return null;
  const previous = error.details?.previousDate;
  const current = error.details?.currentDate;
  return typeof previous === "string" && typeof current === "string" ? { previous, current } : null;
}

const DECIMAL = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * True for an amount the fee columns hold: zero or more, at most two decimal places, and under
 * 100,000,000 (`Numeric(10, 2)`). A negative value is refused here and again by the API.
 */
export function isFeeAmount(value: string): boolean {
  return DECIMAL.test(value.trim());
}

/**
 * A percentage in hundredths of a percent (`"33.33"` is 3333), or null when it is not a
 * non-negative number with at most two decimals. Whole numbers keep the sum exact: adding
 * floats would turn 33.33 + 33.33 + 33.34 into something other than 100.
 */
export function percentHundredths(value: string): number | null {
  const text = value.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** The installment total in hundredths, or null while any share is not a valid percentage. */
export function installmentTotal(percentages: readonly string[]): number | null {
  let total = 0;
  for (const value of percentages) {
    const share = percentHundredths(value);
    if (share === null) return null;
    total += share;
  }
  return total;
}

/** Hundredths of a percent as the decimal string a person reads: 9950 is "99.50". */
export function formatHundredths(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function decimal(value: unknown): string {
  return typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value) ? value : parse.invalid();
}

function isoDate(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : parse.invalid();
}

function parseFeeStructure(value: unknown): FeeStructure {
  const raw = parse.record(value);
  return {
    academicTermId: parse.string(raw.academicTermId),
    tuitionPerUnit: decimal(raw.tuitionPerUnit),
    programTuitionRates: (raw.programTuitionRates === undefined
      ? []
      : parse.array(raw.programTuitionRates)
    ).map((item) => {
      const rate = parse.record(item);
      return {
        programId: parse.string(rate.programId),
        tuitionPerUnit: decimal(rate.tuitionPerUnit),
      };
    }),
    registrationFee: decimal(raw.registrationFee),
    labFee: decimal(raw.labFee),
    miscFee: decimal(raw.miscFee),
    lateFeeRate: decimal(raw.lateFeeRate),
    dueDate: raw.dueDate === undefined || raw.dueDate === null ? null : isoDate(raw.dueDate),
    subsidyCoveredFees: (raw.subsidyCoveredFees === undefined
      ? []
      : parse.array(raw.subsidyCoveredFees)
    ).map((code) => parse.string(code)),
    installments: (raw.installments === undefined ? [] : parse.array(raw.installments)).map(
      (item) => {
        const installment = parse.record(item);
        return {
          installmentNumber: parse.nonNegativeInteger(installment.installmentNumber),
          percentage: decimal(installment.percentage),
          dueDate: isoDate(installment.dueDate),
        };
      },
    ),
  };
}

function parseOptions(value: unknown): FeeStructureOptions {
  const raw = parse.record(value);
  return {
    terms: parse.array(raw.terms).map((item) => {
      const term = parse.record(item);
      return {
        id: parse.string(term.id),
        academicYear: parse.string(term.academicYear),
        semester: parse.string(term.semester),
        isCurrent: parse.boolean(term.isCurrent),
        hasFeeStructure: parse.boolean(term.hasFeeStructure),
      };
    }),
    programs: parse.array(raw.programs).map((item) => {
      const program = parse.record(item);
      return {
        id: parse.string(program.id),
        code: parse.string(program.code),
        name: parse.string(program.name),
      };
    }),
  };
}

/** Finance's fee structure endpoints (US-FIN-003). Only the `ManageFeeStructure` holder may call. */
export function createAdminFeeApi(client: ApiClient) {
  const path = (termId: string) => `/admin/fee-structures/${encodeURIComponent(termId)}`;
  return {
    /** The terms and active programs the form picks from (`GET /admin/fee-structures/options`). */
    async options(accessToken: string, signal?: AbortSignal): Promise<FeeStructureOptions> {
      const data = await client.request("/admin/fee-structures/options", {
        method: "GET",
        accessToken,
        signal,
      });
      return parseOptions(data);
    },

    async get(accessToken: string, termId: string, signal?: AbortSignal): Promise<FeeStructure> {
      const data = await client.request(path(termId), { method: "GET", accessToken, signal });
      return parseFeeStructure(data);
    },

    async save(
      accessToken: string,
      termId: string,
      input: FeeStructureInput,
    ): Promise<FeeStructure> {
      const body: Schemas["FeeStructureSaveRequest"] = {
        tuitionPerUnit: input.tuitionPerUnit,
        programTuitionRates: input.programTuitionRates,
        registrationFee: input.registrationFee,
        labFee: input.labFee,
        miscFee: input.miscFee,
        lateFeeRate: input.lateFeeRate,
        dueDate: input.dueDate,
        subsidyCoveredFees: input.subsidyCoveredFees,
        installments: input.installments,
      };
      return parseFeeStructure(
        await client.request(path(termId), { method: "PUT", accessToken, body }),
      );
    },
  };
}

export type AdminFeeApi = ReturnType<typeof createAdminFeeApi>;
