import type { CurriculumVersion, CurriculumVersionInput } from "@cbpupsis/shared/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent } from "react";

import {
  button,
  card,
  catalogFailure,
  errorText,
  field,
  label,
  primary,
  UUID_PATTERN,
} from "./catalogUi";
import type { CatalogDataSource } from "./dataSource";
import { catalogKeys, useCourseOptions, usePublishedVersions } from "./useCatalog";
import { CourseSelect, FailureMessage, ReadOnlyNotice } from "./widgets";

interface Props {
  source: CatalogDataSource;
  adminId: string;
  editor: boolean;
}

interface Row {
  key: number;
  courseId: string;
  yearLevel: string;
  semester: string;
}

const SEMESTERS = ["First Semester", "Second Semester", "Summer"];

export function CurriculaTab({ source, adminId, editor }: Props) {
  if (!editor) {
    return (
      <section className={card} aria-labelledby="catalog-curricula-heading">
        <h2 id="catalog-curricula-heading" className="text-brand-ink text-lg font-bold">
          Curriculum versions
        </h2>
        <ReadOnlyNotice>
          The catalog service does not list curriculum versions yet, so there is nothing to show
          here. Department Chairs publish versions from this tab.
        </ReadOnlyNotice>
      </section>
    );
  }
  return <CurriculaEditor source={source} adminId={adminId} />;
}

function CurriculaEditor({ source, adminId }: { source: CatalogDataSource; adminId: string }) {
  const client = useQueryClient();
  const id = useId();
  const options = useCourseOptions(source, adminId, true);
  const published = usePublishedVersions(adminId);
  const [programCode, setProgramCode] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [curriculumYear, setCurriculumYear] = useState("");
  const [rows, setRows] = useState<Row[]>([
    { key: 0, courseId: "", yearLevel: "1", semester: SEMESTERS[0]! },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [versionId, setVersionId] = useState("");
  const [versionIdError, setVersionIdError] = useState<string | null>(null);

  const publish = useMutation({
    mutationFn: ({ code, body }: { code: string; body: CurriculumVersionInput }) =>
      source.publishVersion(code, body),
    onSuccess: (version) => {
      client.setQueryData<CurriculumVersion[]>(catalogKeys.versions(adminId), (current = []) => [
        version,
        ...current,
      ]);
      setNotice(
        `${version.programCode} curriculum ${version.curriculumYear} published for students admitted from ${version.effectiveAdmissionYear ?? "the chosen year"}. Earlier students keep their version.`,
      );
    },
  });
  const remove = useMutation({
    mutationFn: (target: { versionId: string; from: "row" | "form" }) =>
      source.deleteVersion(target.versionId),
    onSuccess: (_, target) => {
      client.setQueryData<CurriculumVersion[]>(catalogKeys.versions(adminId), (current = []) =>
        current.filter((item) => item.id !== target.versionId),
      );
      setNotice("Curriculum version deleted.");
      if (target.from === "form") setVersionId("");
    },
  });
  const removeFailure = remove.isError ? catalogFailure(remove.error) : null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (publish.isPending) return;
    const next: Record<string, string> = {};
    if (!programCode.trim()) next.programCode = "Enter the program code, such as BSCS.";
    const admission = Number(year);
    if (!Number.isInteger(admission) || admission < 1900 || admission > 2200)
      next.year = "Enter a four-digit admission year.";
    rows.forEach((row) => {
      if (!row.courseId) next[`row-${row.key}`] = "Choose a course or remove this row.";
    });
    setErrors(next);
    setNotice(null);
    if (Object.keys(next).length) return;
    publish.mutate({
      code: programCode.trim().toUpperCase(),
      body: {
        effectiveAdmissionYear: admission,
        curriculumYear: curriculumYear.trim() || null,
        courses: rows.map((row) => ({
          courseId: row.courseId,
          yearLevel: Number(row.yearLevel),
          semester: row.semester,
        })),
      },
    });
  }

  const courses = options.data?.items ?? [];
  const publishFailure = publish.isError ? catalogFailure(publish.error) : null;

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className={card + " text-brand-success"}>
          {notice}
        </p>
      )}
      <section className={card} aria-labelledby={`${id}-publish`}>
        <h2 id={`${id}-publish`} className="text-brand-ink text-lg font-bold">
          Publish a curriculum version
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          A new version applies to students admitted from its effective year. Students admitted
          earlier keep their version and prescribed load. Fields marked * are required.
        </p>
        <form noValidate onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`${id}-program`} className={label}>
                Program code <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${id}-program`}
                required
                className={field + " mt-2"}
                value={programCode}
                aria-invalid={errors.programCode ? true : undefined}
                aria-describedby={errors.programCode ? `${id}-program-error` : undefined}
                onChange={(event) => setProgramCode(event.target.value)}
              />
              {errors.programCode && (
                <p id={`${id}-program-error`} className={errorText}>
                  {errors.programCode}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${id}-year`} className={label}>
                Effective admission year <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${id}-year`}
                required
                inputMode="numeric"
                className={field + " mt-2"}
                value={year}
                aria-invalid={errors.year ? true : undefined}
                aria-describedby={errors.year ? `${id}-year-error` : undefined}
                onChange={(event) => setYear(event.target.value)}
              />
              {errors.year && (
                <p id={`${id}-year-error`} className={errorText}>
                  {errors.year}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${id}-cy`} className={label}>
                Curriculum year
              </label>
              <input
                id={`${id}-cy`}
                className={field + " mt-2"}
                placeholder="2026-2027"
                value={curriculumYear}
                onChange={(event) => setCurriculumYear(event.target.value)}
              />
            </div>
          </div>
          <fieldset className="border-brand-input-border rounded-lg border p-3">
            <legend className={label + " px-1"}>Courses in this version</legend>
            {options.isPending ? (
              <p role="status" className="text-sm">
                Loading courses…
              </p>
            ) : options.isError ? (
              <div className="text-sm">
                <FailureMessage failure={catalogFailure(options.error)} />
                <button
                  type="button"
                  className={button + " mt-2"}
                  onClick={() => void options.refetch()}
                >
                  Retry course list
                </button>
              </div>
            ) : (
              <ul className="space-y-4">
                {rows.map((row, index) => (
                  <li
                    key={row.key}
                    className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
                  >
                    <CourseSelect
                      id={`${id}-row-${row.key}`}
                      text={`Course ${index + 1}`}
                      courses={courses}
                      value={row.courseId}
                      error={errors[`row-${row.key}`]}
                      onChange={(courseId) =>
                        setRows(rows.map((r) => (r.key === row.key ? { ...r, courseId } : r)))
                      }
                    />
                    <div>
                      <label htmlFor={`${id}-level-${row.key}`} className={label}>
                        Year level
                      </label>
                      <select
                        id={`${id}-level-${row.key}`}
                        className={field + " mt-2"}
                        value={row.yearLevel}
                        onChange={(event) =>
                          setRows(
                            rows.map((r) =>
                              r.key === row.key ? { ...r, yearLevel: event.target.value } : r,
                            ),
                          )
                        }
                      >
                        {[1, 2, 3, 4, 5, 6].map((level) => (
                          <option key={level} value={level}>
                            Year {level}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${id}-sem-${row.key}`} className={label}>
                        Semester
                      </label>
                      <select
                        id={`${id}-sem-${row.key}`}
                        className={field + " mt-2"}
                        value={row.semester}
                        onChange={(event) =>
                          setRows(
                            rows.map((r) =>
                              r.key === row.key ? { ...r, semester: event.target.value } : r,
                            ),
                          )
                        }
                      >
                        {SEMESTERS.map((semester) => (
                          <option key={semester}>{semester}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className={button}
                      disabled={rows.length === 1}
                      aria-label={`Remove course ${index + 1}`}
                      onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className={button + " mt-4"}
              onClick={() =>
                setRows([
                  ...rows,
                  {
                    key: Math.max(...rows.map((r) => r.key)) + 1,
                    courseId: "",
                    yearLevel: "1",
                    semester: SEMESTERS[0]!,
                  },
                ])
              }
            >
              Add another course
            </button>
          </fieldset>
          {publishFailure && (
            <div role="alert">
              <FailureMessage failure={publishFailure} />
            </div>
          )}
          <button
            type="submit"
            className={primary}
            disabled={publish.isPending}
            aria-busy={publish.isPending}
          >
            {publish.isPending ? "Publishing…" : "Publish version"}
          </button>
        </form>
      </section>

      <section className={card} aria-labelledby={`${id}-published`}>
        <h2 id={`${id}-published`} className="text-brand-ink text-lg font-bold">
          Versions published in this session
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          The catalog service does not list curriculum versions yet. Versions you publish here
          appear below until you leave the portal.
        </p>
        {published.data.length === 0 ? (
          <p className="text-brand-muted py-4 text-sm">None yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {published.data.map((version) => (
              <li key={version.id} className="border-brand-border/25 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-semibold">
                      {version.programCode} {version.curriculumYear}
                    </span>
                    , from admission year {version.effectiveAdmissionYear ?? "not set"},{" "}
                    {version.courseCount} courses
                  </p>
                  <button
                    type="button"
                    className={button}
                    disabled={remove.isPending}
                    aria-label={`Delete ${version.programCode} ${version.curriculumYear}`}
                    onClick={() => remove.mutate({ versionId: version.id, from: "row" })}
                  >
                    Delete
                  </button>
                </div>
                {removeFailure &&
                  remove.variables?.from === "row" &&
                  remove.variables.versionId === version.id && (
                    <div role="alert">
                      <FailureMessage failure={removeFailure} />
                    </div>
                  )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby={`${id}-delete`}>
        <h2 id={`${id}-delete`} className="text-brand-ink text-lg font-bold">
          Delete a curriculum version
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          A version with students bound to it cannot be deleted.
        </p>
        <form
          noValidate
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (remove.isPending) return;
            const value = versionId.trim();
            if (!UUID_PATTERN.test(value)) {
              setVersionIdError("Enter the version ID, a 36-character UUID.");
              return;
            }
            setVersionIdError(null);
            setNotice(null);
            remove.mutate({ versionId: value, from: "form" });
          }}
        >
          <div className="min-w-0 flex-1 basis-64">
            <label htmlFor={`${id}-version-id`} className={label}>
              Version ID <span aria-hidden="true">*</span>
            </label>
            <input
              id={`${id}-version-id`}
              required
              className={field + " mt-2"}
              value={versionId}
              aria-invalid={versionIdError ? true : undefined}
              aria-describedby={versionIdError ? `${id}-version-id-error` : undefined}
              onChange={(event) => setVersionId(event.target.value)}
            />
            {versionIdError && (
              <p id={`${id}-version-id-error`} className={errorText}>
                {versionIdError}
              </p>
            )}
          </div>
          <button type="submit" className={button} disabled={remove.isPending}>
            Delete version
          </button>
        </form>
        {removeFailure && remove.variables?.from === "form" && (
          <div role="alert">
            <FailureMessage failure={removeFailure} />
          </div>
        )}
      </section>
    </div>
  );
}
