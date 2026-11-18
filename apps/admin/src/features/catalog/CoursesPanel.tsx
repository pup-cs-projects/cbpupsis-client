import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  AdminTable,
  ApiFailure,
  Field,
  Pagination,
  adminButton,
  adminCard,
  adminField,
  adminPrimary,
} from "../../components/AdminPage";
import { useAdminQuery } from "../../lib/adminQueries";
import type { Course, CourseInput } from "@cbpupsis/shared/catalog/admin";
import { ApiError } from "@cbpupsis/shared/api";
import { catalogApi } from "./api";
import { CatalogError } from "./CatalogError";

function CourseForm({
  course,
  onSaved,
  onCancel,
}: {
  course: Course | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const save = useMutation({
    mutationFn: (input: CourseInput) => catalogApi.saveCourse(input, course?.id),
    retry: false,
    onSuccess: onSaved,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const codes = (key: string) =>
      value(key)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    save.mutate({
      courseCode: value("code"),
      title: value("title"),
      description: value("description") || null,
      lectureUnits: value("lecture"),
      labUnits: value("lab"),
      gradingMode: value("mode"),
      isActive: form.has("active"),
      prerequisiteIds: codes("prerequisites"),
      corequisiteIds: codes("corequisites"),
    });
  }
  const prerequisiteError =
    save.error instanceof ApiError && save.error.code === "CATALOG_PREREQUISITE_CYCLE";
  return (
    <section className={adminCard} aria-labelledby="course-form-heading">
      <h2 id="course-form-heading" className="text-lg font-bold">
        {course ? "Edit course" : "Create course"}
      </h2>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="sr-only">Course details</legend>
          <Field label="Course code">
            <input
              name="code"
              className={adminField}
              required
              maxLength={20}
              defaultValue={course?.code}
            />
          </Field>
          <Field label="Course title">
            <input
              name="title"
              className={adminField}
              required
              maxLength={255}
              defaultValue={course?.title}
            />
          </Field>
          <Field label="Lecture units">
            <input
              name="lecture"
              className={adminField}
              required
              type="number"
              min="0"
              step="0.01"
              defaultValue={course?.lectureUnits ?? "3"}
            />
          </Field>
          <Field label="Laboratory units">
            <input
              name="lab"
              className={adminField}
              required
              type="number"
              min="0"
              step="0.01"
              defaultValue={course?.labUnits ?? "0"}
            />
          </Field>
          <Field label="Grading mode">
            <select
              name="mode"
              className={adminField}
              defaultValue={course?.gradingMode ?? "NUMERIC"}
            >
              <option value="NUMERIC">Numeric</option>
              <option value="PASS_FAIL">Pass or Fail</option>
              {course && !["NUMERIC", "PASS_FAIL"].includes(course.gradingMode) && (
                <option value={course.gradingMode}>{course.gradingMode}</option>
              )}
            </select>
          </Field>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              name="active"
              type="checkbox"
              defaultChecked={course?.active ?? true}
              className="accent-brand-maroon size-4"
            />
            Active course
          </label>
          <Field label="Prerequisite course codes (comma separated)">
            <input
              aria-invalid={prerequisiteError || undefined}
              aria-describedby={prerequisiteError ? "course-prerequisite-error" : undefined}
              name="prerequisites"
              className={adminField}
              defaultValue={course?.prerequisites.join(", ")}
            />
          </Field>
          {prerequisiteError && <CatalogError error={save.error} id="course-prerequisite-error" />}
          <Field label="Corequisite course codes (comma separated)">
            <input
              name="corequisites"
              className={adminField}
              defaultValue={course?.corequisites.join(", ")}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description (optional)">
              <textarea
                name="description"
                className={adminField}
                rows={3}
                defaultValue={course?.description ?? ""}
              />
            </Field>
          </div>
        </fieldset>
        {save.isError && !prerequisiteError && <CatalogError error={save.error} />}
        <div className="flex flex-wrap gap-2">
          <button className={adminPrimary} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save course"}
          </button>
          <button
            type="button"
            className={adminButton}
            disabled={save.isPending}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
export function CoursesPanel({ canEdit }: { canEdit: boolean }) {
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Course | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const list = useAdminQuery(["courses", search, offset], (signal) =>
    catalogApi.courses(search, offset, signal),
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(String(new FormData(event.currentTarget).get("search")).trim());
    setOffset(0);
  }
  return (
    <div className="space-y-5">
      {canEdit && (
        <button
          type="button"
          className={adminPrimary}
          disabled={!list.isSuccess}
          onClick={() => {
            setNotice("");
            setEditing(null);
          }}
        >
          Create course
        </button>
      )}
      <form
        className={adminCard + " flex flex-wrap items-end gap-3 [&>div]:min-w-0 [&>div]:flex-1"}
        onSubmit={submit}
      >
        <Field label="Search courses">
          <input
            name="search"
            className={adminField}
            maxLength={100}
            placeholder="Course code or title"
          />
        </Field>
        <button className={adminButton}>Search</button>
      </form>
      {notice && <p role="status">{notice}</p>}
      {canEdit && editing !== undefined && (
        <CourseForm
          key={editing?.id ?? "new"}
          course={editing}
          onCancel={() => setEditing(undefined)}
          onSaved={() => {
            setNotice("Course saved.");
            setEditing(undefined);
            void list.refetch();
          }}
        />
      )}
      {list.isPending && <p role="status">Loading course catalog…</p>}
      {list.isError && <ApiFailure error={list.error} retry={() => void list.refetch()} />}
      {list.data && (
        <>
          <AdminTable
            caption="Course catalog"
            headings={[
              "Code",
              "Title",
              "Units",
              "Grading",
              "Status",
              ...(canEdit ? ["Action"] : []),
            ]}
          >
            {list.data.items.map((course) => (
              <tr key={course.id}>
                <th scope="row" className="px-4 py-4">
                  {course.code}
                </th>
                <td className="px-4 py-4">{course.title}</td>
                <td className="px-4 py-4">{course.totalUnits}</td>
                <td className="px-4 py-4">
                  {course.gradingMode === "PASS_FAIL"
                    ? "Pass or Fail"
                    : course.gradingMode === "NUMERIC"
                      ? "Numeric"
                      : course.gradingMode}
                </td>
                <td className="px-4 py-4">{course.active ? "Active" : "Inactive"}</td>
                {canEdit && (
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      className={adminButton}
                      aria-label={`Edit ${course.code}`}
                      onClick={() => {
                        setNotice("");
                        setEditing(course);
                      }}
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </AdminTable>
          {list.data.items.length === 0 && <p>No courses match your search.</p>}
          <Pagination
            offset={offset}
            total={list.data.total}
            busy={list.isFetching}
            onChange={setOffset}
          />
        </>
      )}
    </div>
  );
}
