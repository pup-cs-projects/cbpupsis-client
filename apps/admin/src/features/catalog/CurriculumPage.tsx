import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  Field,
  adminButton,
  adminCard,
  adminField,
  adminPrimary,
} from "../../components/AdminPage";
import type { CurriculumInput } from "@cbpupsis/shared/catalog/admin";
import { catalogApi } from "./api";
import { CatalogError } from "./CatalogError";

export function CurriculumPanel({ canEdit }: { canEdit: boolean }) {
  const [rows, setRows] = useState([1]);
  const [serial, setSerial] = useState(2);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const publish = useMutation({
    mutationFn: ({ program, input }: { program: string; input: CurriculumInput }) =>
      catalogApi.publishCurriculum(program, input),
    retry: false,
    onSuccess: () => setDeleted(false),
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (publish.data)
        await catalogApi.deleteCurriculum(publish.data.programCode, publish.data.id);
    },
    retry: false,
    onSuccess: () => {
      setConfirming(false);
      setDeleted(true);
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    setConfirming(false);
    remove.reset();
    publish.mutate({
      program: value("program"),
      input: {
        effectiveAdmissionYear: Number(value("year")),
        curriculumYear: value("version"),
        courses: rows.map((key) => ({
          courseCode: value(`course-${key}`),
          yearLevel: Number(value(`level-${key}`)),
          semester: value(`semester-${key}`),
          courseType: value(`type-${key}`),
        })),
      },
    });
  }
  if (!canEdit)
    return (
      <section className={adminCard}>
        <h2 className="text-xl font-bold">Curriculum versions</h2>
        <p className="text-brand-muted mt-3 text-sm">
          Curriculum versions are not available for browsing yet. Your account has read-only access.
        </p>
      </section>
    );
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold">Curriculum versions</h2>
      <p className="text-brand-muted text-sm">
        Published versions cannot be browsed yet. New versions saved here are confirmed by the
        server.
      </p>
      <form onSubmit={submit} className={adminCard + " space-y-5"}>
        <fieldset
          disabled={publish.isPending || remove.isPending}
          className="grid min-w-0 gap-4 sm:grid-cols-2"
        >
          <legend className="sr-only">Curriculum version details</legend>
          <Field label="Program code">
            <input className={adminField} name="program" required maxLength={30} />
          </Field>
          <Field label="Version name">
            <input className={adminField} name="version" required maxLength={20} />
          </Field>
          <Field label="Effective admission year">
            <input
              type="number"
              name="year"
              className={adminField}
              required
              min="1900"
              max="2200"
              step="1"
            />
          </Field>
        </fieldset>
        <fieldset disabled={publish.isPending || remove.isPending} className="min-w-0 space-y-3">
          <legend className="font-semibold">Curriculum courses</legend>
          {rows.map((key, index) => (
            <div
              key={key}
              className="border-brand-border/25 grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-2"
            >
              <Field label={`Course ${index + 1} code`}>
                <input name={`course-${key}`} className={adminField} required maxLength={20} />
              </Field>
              <Field label={`Course ${index + 1} year level`}>
                <input
                  type="number"
                  name={`level-${key}`}
                  className={adminField}
                  required
                  min="1"
                  max="6"
                  defaultValue="1"
                />
              </Field>
              <Field label={`Course ${index + 1} semester`}>
                <select name={`semester-${key}`} className={adminField}>
                  <option>First Semester</option>
                  <option>Second Semester</option>
                  <option>Summer</option>
                </select>
              </Field>
              <Field label={`Course ${index + 1} classification`}>
                <input
                  name={`type-${key}`}
                  className={adminField}
                  required
                  defaultValue="core"
                  maxLength={30}
                />
              </Field>
              <button
                type="button"
                className={adminButton}
                disabled={rows.length === 1}
                onClick={() => setRows((items) => items.filter((item) => item !== key))}
              >
                Remove course {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className={adminButton}
            onClick={() => {
              setRows((items) => [...items, serial]);
              setSerial(serial + 1);
            }}
          >
            Add curriculum course
          </button>
        </fieldset>
        {publish.isError && <CatalogError error={publish.error} />}
        <button className={adminPrimary} disabled={publish.isPending || remove.isPending}>
          {publish.isPending ? "Publishing…" : "Publish curriculum version"}
        </button>
      </form>
      {publish.data && !deleted && (
        <section className={adminCard} aria-labelledby="published-version-heading">
          <h2 id="published-version-heading" className="font-semibold">
            Published version
          </h2>
          <p role="status" className="mt-2 text-sm">
            {publish.data.programCode} · {publish.data.curriculumYear}
          </p>
          <p className="text-brand-muted mt-2 text-sm break-all">Reference: {publish.data.id}</p>
          {confirming ? (
            <div className="mt-4 space-y-3">
              <p>
                Delete this published version? Versions used by existing academic records cannot be
                deleted.
              </p>
              {remove.isError && <CatalogError error={remove.error} />}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={adminButton}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {remove.isPending ? "Deleting…" : "Confirm deletion"}
                </button>
                <button
                  type="button"
                  className={adminButton}
                  disabled={remove.isPending}
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={adminButton + " mt-4"}
              onClick={() => setConfirming(true)}
            >
              Delete this version
            </button>
          )}
        </section>
      )}
      {deleted && <p role="status">Curriculum version deleted.</p>}
    </section>
  );
}
