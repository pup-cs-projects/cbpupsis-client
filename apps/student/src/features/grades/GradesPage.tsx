import { ErrorAlert } from "@cbpupsis/ui";
import { useId, useState } from "react";

import "@cbpupsis/account/styles.css";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { AcademicSummaryCard } from "./GradesSummaryCards";
import { GradesTable } from "./GradesTable";
import { latestGradedTerm, termLabel, useGrades } from "./useGrades";
import "./printGrades.css";

/** The selector's value for every term at once: the full transcript. */
const ALL_TERMS = "all";

const ChevronDownIcon = () => (
  <svg
    className="text-brand-crimson pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const PrinterIcon = () => (
  <svg
    className="size-4 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

function Loading() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading your grades
      </p>
      <div aria-hidden="true" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="bg-brand-skeleton/25 h-11 w-full animate-pulse rounded-xl motion-reduce:animate-none sm:w-[22rem]" />
          <div className="bg-brand-skeleton/25 h-96 animate-pulse rounded-2xl motion-reduce:animate-none" />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <div className="bg-brand-skeleton/25 h-80 animate-pulse rounded-2xl motion-reduce:animate-none" />
          <div className="bg-brand-skeleton/25 h-52 animate-pulse rounded-2xl motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}

/** US-STU-004: the student's final grades by term, the averages, and the appeal window. */
export function GradesPage() {
  const grades = useGrades();
  const data = grades.data;
  const selectId = useId();
  const [selected, setSelected] = useState<string | null>(null);

  const latest = data ? latestGradedTerm(data.terms) : undefined;
  // Until the student picks one, show the newest graded term, as the Figma does.
  const value = selected ?? latest?.termId ?? ALL_TERMS;
  const shownTerms =
    data && value === ALL_TERMS
      ? data.terms
      : (data?.terms.filter((term) => term.termId === value) ?? []);
  const selectedTerm = value === ALL_TERMS ? undefined : shownTerms[0];
  // The rail describes the term on screen; for the full transcript, the newest graded one.
  const railTerm = selectedTerm ?? latest;

  return (
    <DashboardLayout>
      {grades.isError && <ErrorAlert error={grades.error} onRetry={() => void grades.refetch()} />}

      <div data-grades-page className="space-y-6 px-4 py-8 sm:px-8">
        <nav aria-label="Breadcrumb" className="print:hidden">
          <ol className="text-brand-muted flex flex-wrap items-center gap-1.5 text-sm">
            <li>Academics</li>
            <li aria-hidden="true">&gt;</li>
            <li aria-current="page" className="text-brand-ink font-semibold">
              Grades
            </li>
          </ol>
        </nav>

        <div>
          <p className="hidden text-sm font-semibold print:block">
            Polytechnic University of the Philippines: Student Copy of Grades (unofficial)
          </p>
          <h1 className="text-brand-maroon text-3xl font-bold tracking-tight sm:text-4xl">
            Academic Transcript
          </h1>
          <p className="text-brand-muted mt-2 max-w-3xl text-sm leading-relaxed print:hidden">
            View your comprehensive academic performance, semester-wise breakdowns, and cumulative
            standing within the University.
          </p>
        </div>

        {grades.isPending && <Loading />}

        {grades.isError && (
          <div className="border-brand-border/25 rounded-2xl border bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-brand-ink font-semibold">We couldn&apos;t load your grades.</p>
            <p className="text-brand-muted mt-1 text-sm">
              Check your connection and try again. If it keeps happening, contact the registrar.
            </p>
            <button
              type="button"
              onClick={() => void grades.refetch()}
              className="bg-brand-crimson mt-5 min-h-11 rounded-xl px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              Try again
            </button>
          </div>
        )}

        {grades.isSuccess && (!data || data.terms.length === 0) && (
          <p
            role="status"
            className="border-brand-border/25 text-brand-muted rounded-2xl border bg-white px-6 py-10 text-center text-sm"
          >
            No grades posted yet for this academic term. They appear here once the registrar posts
            them.
          </p>
        )}

        {data && data.terms.length > 0 && (
          <>
            {/* Announces the term change; the table below changes with it. */}
            <p role="status" aria-live="polite" className="sr-only">
              {value === ALL_TERMS
                ? `Showing all ${data.terms.length} terms`
                : selectedTerm && `Showing grades for ${termLabel(selectedTerm)}`}
            </p>

            {/* Toolbar: the term on the left, Print across from it. Bottom-aligned, so the button
                lines up with the select rather than with its label. */}
            <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
              <div className="w-full sm:w-auto">
                <label
                  htmlFor={selectId}
                  className="text-brand-muted block text-xs font-semibold tracking-wide uppercase"
                >
                  Term
                </label>
                <div className="relative mt-1.5 w-full sm:w-fit">
                  <select
                    id={selectId}
                    value={value}
                    onChange={(event) => setSelected(event.target.value)}
                    className="border-brand-input-border text-brand-ink hover:border-brand-crimson min-h-11 w-full appearance-none rounded-xl border bg-white py-2 pr-10 pl-4 text-base font-bold sm:min-w-[24rem]"
                  >
                    {data.terms.map((term) => (
                      <option key={term.termId} value={term.termId}>
                        Academic Year {term.academicYear} | {term.semester}
                      </option>
                    ))}
                    <option value={ALL_TERMS}>All terms (full transcript)</option>
                  </select>
                  <ChevronDownIcon />
                </div>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="text-brand-ink flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium transition-colors hover:bg-neutral-50"
              >
                <PrinterIcon />
                Print Grades
              </button>
            </div>

            {/* The selector sits above the grid, so the table and the summary start on one line. */}
            <div className="grades-layout grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="min-w-0 space-y-8 lg:col-span-8">
                {shownTerms.map((term) => (
                  <GradesTable key={term.termId} term={term} showTitle={value === ALL_TERMS} />
                ))}
              </div>

              {/* The rail stays in view while the table scrolls; one column below 1024px. */}
              <aside
                aria-label="Academic summary and actions"
                className="space-y-6 lg:sticky lg:top-6 lg:col-span-4 lg:self-start"
              >
                <AcademicSummaryCard summary={data.summary} term={railTerm} />
              </aside>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
