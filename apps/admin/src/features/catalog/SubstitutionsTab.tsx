import type { SubstitutionInput } from "@cbpupsis/shared/catalog";
import { useMutation } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";

import {
  button,
  card,
  catalogFailure,
  errorText,
  field,
  label,
  primary,
  splitIds,
  UUID_PATTERN,
} from "./catalogUi";
import type { CatalogDataSource } from "./dataSource";
import { useCourseOptions } from "./useCatalog";
import { CourseSelect, FailureMessage, ReadOnlyNotice } from "./widgets";

interface Props {
  source: CatalogDataSource;
  adminId: string;
  editor: boolean;
}

export function SubstitutionsTab({ source, adminId, editor }: Props) {
  if (!editor) {
    return (
      <section className={card} aria-labelledby="catalog-substitutions-heading">
        <h2 id="catalog-substitutions-heading" className="text-brand-ink text-lg font-bold">
          Substitutions
        </h2>
        <ReadOnlyNotice>
          The catalog service does not list approved substitutions yet, so there is nothing to show
          here. Department Chairs approve substitutions from this tab.
        </ReadOnlyNotice>
      </section>
    );
  }
  return <SubstitutionForm source={source} adminId={adminId} />;
}

function SubstitutionForm({ source, adminId }: { source: CatalogDataSource; adminId: string }) {
  const id = useId();
  const options = useCourseOptions(source, adminId, true);
  const [original, setOriginal] = useState("");
  const [substitute, setSubstitute] = useState("");
  const [students, setStudents] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const approve = useMutation({
    mutationFn: (body: SubstitutionInput) => source.approveSubstitution(body),
    onSuccess: (result) => {
      const codeOf = (courseId: string) =>
        options.data?.items.find((course) => course.id === courseId)?.courseCode ?? "the course";
      setNotice(
        `Substitution approved for ${result.studentIds.length} ${result.studentIds.length === 1 ? "student" : "students"}. ${codeOf(result.substituteCourseId)} now counts for ${codeOf(result.originalCourseId)} in their degree progress only.`,
      );
      setStudents("");
    },
  });
  const failure = approve.isError ? catalogFailure(approve.error) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (approve.isPending) return;
    const ids = splitIds(students);
    const next: Record<string, string> = {};
    if (!original) next.original = "Choose the course the curriculum dropped.";
    if (!substitute) next.substitute = "Choose the course that replaces it.";
    else if (substitute === original) next.substitute = "Choose a different course.";
    if (ids.length === 0) next.students = "Enter at least one student ID.";
    else if (!ids.every((value) => UUID_PATTERN.test(value)))
      next.students = "Each student ID is a 36-character UUID. Separate them with new lines.";
    setErrors(next);
    setNotice(null);
    if (Object.keys(next).length) return;
    approve.mutate({
      originalCourseId: original,
      substituteCourseId: substitute,
      studentIds: [...new Set(ids)],
    });
  }

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className={card + " text-brand-success"}>
          {notice}
        </p>
      )}
      <section className={card} aria-labelledby={`${id}-heading`}>
        <h2 id={`${id}-heading`} className="text-brand-ink text-lg font-bold">
          Approve a substitution
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          The substitute counts for the original course only for the students you name. Fields
          marked * are required.
        </p>
        {options.isError ? (
          <div role="alert" className="mt-4">
            <FailureMessage failure={catalogFailure(options.error)} />
            <button
              type="button"
              className={button + " mt-2"}
              onClick={() => void options.refetch()}
            >
              Retry course list
            </button>
          </div>
        ) : options.isPending ? (
          <p role="status" className="mt-4 text-sm">
            Loading courses…
          </p>
        ) : (
          <form noValidate onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <CourseSelect
              id={`${id}-original`}
              text="Original course"
              courses={options.data.items}
              value={original}
              error={errors.original}
              onChange={setOriginal}
            />
            <CourseSelect
              id={`${id}-substitute`}
              text="Substitute course"
              courses={options.data.items}
              value={substitute}
              error={errors.substitute}
              onChange={setSubstitute}
            />
            <div className="sm:col-span-2">
              <label htmlFor={`${id}-students`} className={label}>
                Student IDs <span aria-hidden="true">*</span>
              </label>
              <p id={`${id}-students-hint`} className="text-brand-muted text-xs">
                One student ID per line.
              </p>
              <textarea
                id={`${id}-students`}
                required
                className={field + " mt-2 min-h-28 font-mono"}
                value={students}
                aria-invalid={errors.students ? true : undefined}
                aria-describedby={
                  errors.students
                    ? `${id}-students-hint ${id}-students-error`
                    : `${id}-students-hint`
                }
                onChange={(event) => setStudents(event.target.value)}
              />
              {errors.students && (
                <p id={`${id}-students-error`} className={errorText}>
                  {errors.students}
                </p>
              )}
            </div>
            {failure && (
              <div role="alert" className="sm:col-span-2">
                <FailureMessage failure={failure} />
              </div>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                className={primary}
                disabled={approve.isPending}
                aria-busy={approve.isPending}
              >
                {approve.isPending ? "Approving…" : "Approve substitution"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
