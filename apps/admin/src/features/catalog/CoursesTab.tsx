import type { CatalogCourse, CatalogCourseInput } from "@cbpupsis/shared/catalog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  button,
  card,
  catalogFailure,
  errorText,
  field,
  isForbidden,
  label,
  primary,
  type CatalogFailure,
} from "./catalogUi";
import type { CatalogDataSource } from "./dataSource";
import { catalogKeys, PAGE_SIZE, useCourseOptions, useCourses } from "./useCatalog";
import { FailureMessage, RequisitePicker } from "./widgets";

interface Props {
  source: CatalogDataSource;
  adminId: string;
  editor: boolean;
}

export function CoursesTab({ source, adminId, editor }: Props) {
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<CatalogCourse | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const courses = useCourses(source, adminId, applied, offset);
  const page = courses.data;

  if (courses.isError && isForbidden(courses.error)) {
    return <p role="alert">This page is not available to your role.</p>;
  }

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className={card + " text-brand-success"}>
          {notice}
        </p>
      )}
      {editor && editing && (
        <CourseForm
          key={editing === "new" ? "new" : editing.id}
          source={source}
          adminId={adminId}
          course={editing === "new" ? null : editing}
          onDone={(saved) => {
            setEditing(null);
            if (saved) setNotice(`${saved.courseCode} saved. It can now be offered as sections.`);
          }}
        />
      )}
      <section className={card} aria-labelledby="catalog-courses-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 id="catalog-courses-heading" className="text-brand-ink text-lg font-bold">
            Courses
          </h2>
          {editor && (
            <button
              type="button"
              className={primary}
              onClick={() => {
                setNotice(null);
                setEditing("new");
              }}
            >
              New course
            </button>
          )}
        </div>
        <form
          role="search"
          className="mb-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setOffset(0);
            setApplied(search.trim());
          }}
        >
          <label className={label + " min-w-0 flex-1 basis-56"}>
            Search courses by code or title
            <input
              type="search"
              className={field + " mt-2"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="submit" className={button}>
            Search
          </button>
        </form>

        {courses.isPending ? (
          <p role="status">Loading courses…</p>
        ) : courses.isError ? (
          <div role="alert">
            <FailureMessage failure={catalogFailure(courses.error)} />
            <button
              type="button"
              className={button + " mt-3"}
              onClick={() => void courses.refetch()}
            >
              Retry courses
            </button>
          </div>
        ) : !page || page.items.length === 0 ? (
          <p className="text-brand-muted py-6 text-sm">
            {applied ? "No courses match this search." : "No courses in your scope yet."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <caption className="sr-only">Courses in your scope</caption>
                <thead className="bg-brand-maroon text-white">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Code
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Title
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Units
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Prerequisites
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Term offered
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold">
                      Status
                    </th>
                    {editor && (
                      <th scope="col" className="px-3 py-3 font-semibold">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((course) => (
                    <tr key={course.id} className="border-brand-border/20 border-b align-top">
                      <th scope="row" className="px-3 py-3 font-semibold">
                        {course.courseCode}
                      </th>
                      <td className="px-3 py-3">
                        {course.title}
                        {course.department && (
                          <span className="text-brand-muted block text-xs">
                            {course.department}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">{course.totalUnits}</td>
                      <td className="px-3 py-3">
                        {course.prerequisites.length ? course.prerequisites.join(", ") : "None"}
                      </td>
                      <td className="px-3 py-3">{course.termOffered ?? "Not set"}</td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            "rounded border px-2 py-0.5 text-xs font-semibold " +
                            (course.isActive
                              ? "border-brand-success text-brand-success"
                              : "border-brand-border text-brand-muted")
                          }
                        >
                          {course.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {editor && (
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className={button}
                            aria-label={`Edit ${course.courseCode}`}
                            onClick={() => {
                              setNotice(null);
                              setEditing(course);
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-brand-muted">
                Showing {page.offset + 1} to {page.offset + page.items.length} of {page.total}{" "}
                courses
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={button}
                  disabled={offset === 0 || courses.isFetching}
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous page
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={page.offset + page.items.length >= page.total || courses.isFetching}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next page
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

interface Draft {
  courseCode: string;
  title: string;
  description: string;
  lectureUnits: string;
  labUnits: string;
  termOffered: string;
  isActive: boolean;
  prerequisiteIds: string[];
  corequisiteIds: string[];
}

function draftOf(course: CatalogCourse | null): Draft {
  return {
    courseCode: course?.courseCode ?? "",
    title: course?.title ?? "",
    description: course?.description ?? "",
    lectureUnits: course?.lectureUnits ?? "3",
    labUnits: course?.labUnits ?? "0",
    termOffered: course?.termOffered ?? "",
    isActive: course?.isActive ?? true,
    prerequisiteIds: course?.prerequisiteIds ?? [],
    corequisiteIds: course?.corequisiteIds ?? [],
  };
}

const UNITS = /^\d{1,2}(\.\d{1,2})?$/;

function CourseForm({
  source,
  adminId,
  course,
  onDone,
}: {
  source: CatalogDataSource;
  adminId: string;
  course: CatalogCourse | null;
  onDone: (saved: CatalogCourse | null) => void;
}) {
  const client = useQueryClient();
  const options = useCourseOptions(source, adminId, true);
  const [draft, setDraft] = useState(() => draftOf(course));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const save = useMutation({
    mutationFn: (body: CatalogCourseInput) =>
      course ? source.updateCourse(course.id, body) : source.createCourse(body),
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: catalogKeys.all(adminId) });
      onDone(saved);
    },
  });
  const failure: CatalogFailure | null = save.isError ? catalogFailure(save.error) : null;

  useEffect(() => heading.current?.focus(), []);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (save.isPending) return;
    const next: Partial<Record<keyof Draft, string>> = {};
    if (!draft.courseCode.trim()) next.courseCode = "Enter the course code.";
    if (!draft.title.trim()) next.title = "Enter the course title.";
    if (!UNITS.test(draft.lectureUnits.trim())) next.lectureUnits = "Enter units, such as 3.";
    if (!UNITS.test(draft.labUnits.trim())) next.labUnits = "Enter units, such as 0 or 1.";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({
      courseCode: draft.courseCode.trim(),
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      lectureUnits: draft.lectureUnits.trim(),
      labUnits: draft.labUnits.trim(),
      termOffered: draft.termOffered.trim() || null,
      isActive: draft.isActive,
      prerequisiteIds: draft.prerequisiteIds,
      corequisiteIds: draft.corequisiteIds,
    });
  }

  const choices = (options.data?.items ?? []).filter((item) => item.id !== course?.id);
  const input = (key: "courseCode" | "title" | "lectureUnits" | "labUnits", text: string) => (
    <div>
      <label htmlFor={`${id}-${key}`} className={label}>
        {text} <span aria-hidden="true">*</span>
      </label>
      <input
        id={`${id}-${key}`}
        className={field + " mt-2"}
        required
        inputMode={key.endsWith("Units") ? "decimal" : undefined}
        value={draft[key]}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
        onChange={(event) => set(key, event.target.value)}
      />
      {errors[key] && (
        <p id={`${id}-${key}-error`} className={errorText}>
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <section className={card} aria-labelledby={`${id}-heading`}>
      <h2
        id={`${id}-heading`}
        ref={heading}
        tabIndex={-1}
        className="text-brand-maroon text-xl font-bold"
      >
        {course ? `Edit ${course.courseCode}` : "New course"}
      </h2>
      <p className="text-brand-muted mt-1 text-sm">Fields marked * are required.</p>
      <form noValidate onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        {input("courseCode", "Course code")}
        {input("title", "Title")}
        <div className="sm:col-span-2">
          <label htmlFor={`${id}-description`} className={label}>
            Description
          </label>
          <textarea
            id={`${id}-description`}
            className={field + " mt-2 min-h-24"}
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </div>
        {input("lectureUnits", "Lecture units")}
        {input("labUnits", "Laboratory units")}
        <div>
          <label htmlFor={`${id}-term`} className={label}>
            Term offered
          </label>
          <select
            id={`${id}-term`}
            className={field + " mt-2"}
            value={draft.termOffered}
            onChange={(event) => set("termOffered", event.target.value)}
          >
            <option value="">Not set</option>
            <option value="First Semester">First Semester</option>
            <option value="Second Semester">Second Semester</option>
            <option value="Summer">Summer</option>
            <option value="Any Term">Any term</option>
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-3 self-end text-sm font-medium">
          <input
            type="checkbox"
            className="size-5"
            checked={draft.isActive}
            onChange={(event) => set("isActive", event.target.checked)}
          />
          Active
        </label>
        <div className="sm:col-span-2">
          <RequisitePicker
            legend="Prerequisites"
            courses={choices}
            loading={options.isPending}
            failed={options.isError}
            onRetry={() => void options.refetch()}
            selected={draft.prerequisiteIds}
            onChange={(ids) => set("prerequisiteIds", ids)}
            error={failure?.field === "prerequisites" ? failure : null}
          />
        </div>
        <div className="sm:col-span-2">
          <RequisitePicker
            legend="Co-requisites"
            courses={choices}
            loading={options.isPending}
            failed={options.isError}
            onRetry={() => void options.refetch()}
            selected={draft.corequisiteIds}
            onChange={(ids) => set("corequisiteIds", ids)}
            error={null}
          />
        </div>
        {failure && failure.field !== "prerequisites" && (
          <div role="alert" className="sm:col-span-2">
            <FailureMessage failure={failure} />
          </div>
        )}
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button
            type="submit"
            className={primary}
            disabled={save.isPending}
            aria-busy={save.isPending}
          >
            {save.isPending ? "Saving…" : course ? "Save changes" : "Add course"}
          </button>
          <button
            type="button"
            className={button}
            disabled={save.isPending}
            onClick={() => onDone(null)}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
