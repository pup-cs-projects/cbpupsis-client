import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { SubstitutionInput } from "@cbpupsis/shared/catalog/admin";
import {
  AdminTable,
  ApiFailure,
  Field,
  adminCard,
  adminField,
  adminPrimary,
  uuidPattern,
} from "../../components/AdminPage";
import { useAdminQuery } from "../../lib/adminQueries";
import { catalogApi } from "./api";
import { CatalogError } from "./CatalogError";

export function SubstitutionsPanel({ canEdit }: { canEdit: boolean }) {
  const [studentId, setStudentId] = useState("");
  const [notice, setNotice] = useState("");
  const result = useAdminQuery(
    ["catalog-degree-progress", studentId],
    (signal) => catalogApi.degreeProgress(studentId, signal),
    Boolean(studentId),
  );
  const approve = useMutation({
    mutationFn: (input: SubstitutionInput) => catalogApi.approveSubstitution(input),
    retry: false,
    onSuccess: (response) => {
      setNotice(
        `Substitution approved for ${response.studentIds.length} ${response.studentIds.length === 1 ? "student" : "students"}.`,
      );
      if (studentId && response.studentIds.includes(studentId)) void result.refetch();
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;
    const form = new FormData(event.currentTarget);
    setNotice("");
    approve.mutate({
      originalCourseId: String(form.get("original")),
      substituteCourseId: String(form.get("substitute")),
      studentIds: [
        ...new Set(
          String(form.get("students"))
            .split(/[\s,]+/)
            .filter(Boolean),
        ),
      ],
    });
  }
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">Course substitutions</h2>
      <p className="text-brand-muted text-sm">
        Look up a student's degree progress to review approved substitutions in your scope.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setStudentId(String(new FormData(event.currentTarget).get("student")).trim());
        }}
        className={adminCard + " flex flex-wrap items-end gap-3"}
      >
        <Field label="Student account reference">
          <input name="student" required pattern={uuidPattern} className={adminField} />
        </Field>
        <button className={adminPrimary}>View degree progress</button>
      </form>
      {studentId && result.isPending && <p role="status">Loading degree progress…</p>}
      {studentId && result.isError && (
        <ApiFailure error={result.error} retry={() => void result.refetch()} />
      )}
      {result.data && (
        <section className="space-y-4" aria-label="Student degree progress">
          <p className="text-sm font-semibold">
            {result.data.completedUnits} of {result.data.totalUnitsRequired} units completed
          </p>
          <AdminTable
            caption="Degree progress and substitutions"
            headings={["Course", "Title", "Status", "Substitution"]}
          >
            {result.data.courses.map((course) => (
              <tr key={course.courseId}>
                <th scope="row" className="px-4 py-4">
                  {course.courseCode}
                </th>
                <td className="px-4 py-4">{course.title}</td>
                <td className="px-4 py-4">{course.completed ? "Completed" : "Not completed"}</td>
                <td className="px-4 py-4">{course.substitutedByCourseCode ?? "None"}</td>
              </tr>
            ))}
          </AdminTable>
          {!result.data.courses.length && (
            <p>No curriculum courses are available for this student.</p>
          )}
        </section>
      )}
      {canEdit && (
        <form onSubmit={submit} className={adminCard + " space-y-4"}>
          <h3 className="font-semibold">Approve a substitution</h3>
          <p className="text-brand-muted text-sm">
            Use the course and student account references from your academic records. The original
            course must belong to your department.
          </p>
          <fieldset disabled={approve.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <legend className="sr-only">Substitution details</legend>
            <Field label="Original course reference">
              <input name="original" className={adminField} pattern={uuidPattern} required />
            </Field>
            <Field label="Substitute course reference">
              <input name="substitute" className={adminField} pattern={uuidPattern} required />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Student account references (comma separated)">
                <textarea
                  name="students"
                  required
                  rows={3}
                  className={adminField}
                  onChange={(event) => {
                    const ids = event.target.value.split(/[\s,]+/).filter(Boolean);
                    event.target.setCustomValidity(
                      ids.every((id) => new RegExp(`^${uuidPattern}$`).test(id))
                        ? ""
                        : "Enter valid student account references.",
                    );
                  }}
                />
              </Field>
            </div>
          </fieldset>
          {approve.isError && <CatalogError error={approve.error} />}
          <button className={adminPrimary} disabled={approve.isPending}>
            {approve.isPending ? "Approving…" : "Approve substitution"}
          </button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
