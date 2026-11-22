import type { CatalogCourse } from "@cbpupsis/shared/catalog";
import { useId } from "react";

import { button, errorText, field, label, type CatalogFailure } from "./catalogUi";

/** A refusal in the API's own words (or ours, by code), with the reference for bug reports. */
export function FailureMessage({ failure, id }: { failure: CatalogFailure; id?: string }) {
  return (
    <p id={id} className={errorText}>
      {failure.message}
      {failure.requestId && (
        <span className="text-brand-muted block text-xs">Reference: {failure.requestId}</span>
      )}
    </p>
  );
}

/** Checkboxes over the courses in scope, so requisites are picked, never typed. */
export function RequisitePicker({
  legend,
  courses,
  loading,
  failed,
  onRetry,
  selected,
  onChange,
  error,
}: {
  legend: string;
  courses: CatalogCourse[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  selected: string[];
  onChange: (ids: string[]) => void;
  error: CatalogFailure | null;
}) {
  const id = useId();
  return (
    <fieldset
      aria-describedby={error ? `${id}-error` : undefined}
      className={
        "rounded-lg border p-3 " + (error ? "border-brand-crimson" : "border-brand-input-border")
      }
    >
      <legend className={label + " px-1"}>{legend}</legend>
      {loading ? (
        <p role="status" className="text-sm">
          Loading courses…
        </p>
      ) : failed ? (
        <div className="text-sm">
          <p>The course list could not be loaded.</p>
          <button type="button" className={button + " mt-2"} onClick={onRetry}>
            Retry course list
          </button>
        </div>
      ) : courses.length === 0 ? (
        <p className="text-brand-muted text-sm">No other courses to choose from.</p>
      ) : (
        <ul className="grid max-h-48 gap-1 overflow-y-auto sm:grid-cols-2">
          {courses.map((course) => (
            <li key={course.id}>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-5 shrink-0"
                  checked={selected.includes(course.id)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, course.id]
                        : selected.filter((item) => item !== course.id),
                    )
                  }
                />
                <span className="min-w-0 break-words">
                  {course.courseCode}: {course.title}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div role="alert">
          <FailureMessage failure={error} id={`${id}-error`} />
        </div>
      )}
    </fieldset>
  );
}

/** One required course select over the courses in scope. */
export function CourseSelect({
  id,
  text,
  courses,
  value,
  onChange,
  error,
}: {
  id: string;
  text: string;
  courses: CatalogCourse[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {text} <span aria-hidden="true">*</span>
      </label>
      <select
        id={id}
        required
        className={field + " mt-2"}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose a course</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.courseCode}: {course.title}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className={errorText}>
          {error}
        </p>
      )}
    </div>
  );
}

/** For tabs the API cannot list yet: say so plainly instead of showing a false empty state. */
export function ReadOnlyNotice({ children }: { children: string }) {
  return <p className="text-brand-muted text-sm leading-relaxed">{children}</p>;
}
