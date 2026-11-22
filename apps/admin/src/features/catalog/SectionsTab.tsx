import type { CatalogSection, SectionInput, SectionUpdate } from "@cbpupsis/shared/catalog";
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
import { catalogKeys, useCourseOptions, useCreatedSections } from "./useCatalog";
import { CourseSelect, FailureMessage, ReadOnlyNotice } from "./widgets";

interface Props {
  source: CatalogDataSource;
  adminId: string;
  editor: boolean;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function SectionsTab({ source, adminId, editor }: Props) {
  if (!editor) {
    return (
      <section className={card} aria-labelledby="catalog-sections-heading">
        <h2 id="catalog-sections-heading" className="text-brand-ink text-lg font-bold">
          Sections
        </h2>
        <ReadOnlyNotice>
          The catalog service does not list sections yet, so there is nothing to show here.
          Department Chairs create and edit sections from this tab.
        </ReadOnlyNotice>
      </section>
    );
  }
  return <SectionsEditor source={source} adminId={adminId} />;
}

interface Draft {
  courseId: string;
  sectionName: string;
  facultyId: string;
  capacity: string;
  room: string;
  day: string;
  start: string;
  end: string;
  type: "lecture" | "laboratory";
}

const EMPTY: Draft = {
  courseId: "",
  sectionName: "",
  facultyId: "",
  capacity: "40",
  room: "",
  day: "0",
  start: "08:00",
  end: "10:00",
  type: "lecture",
};

function wholeNumber(value: string, min: number): number | null {
  const number = Number(value);
  return /^\d+$/.test(value.trim()) && number >= min ? number : null;
}

function SectionsEditor({ source, adminId }: { source: CatalogDataSource; adminId: string }) {
  const client = useQueryClient();
  const id = useId();
  const options = useCourseOptions(source, adminId, true);
  const created = useCreatedSections(adminId);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [edit, setEdit] = useState({ sectionId: "", capacity: "", room: "" });
  const [editErrors, setEditErrors] = useState<{ sectionId?: string; capacity?: string }>({});

  const remember = (section: CatalogSection) =>
    client.setQueryData<CatalogSection[]>(catalogKeys.sections(adminId), (current = []) => [
      section,
      ...current.filter((item) => item.id !== section.id),
    ]);

  const create = useMutation({
    mutationFn: (body: SectionInput) => source.createSection(body),
    onSuccess: (section) => {
      remember(section);
      setDraft(EMPTY);
      setNotice(
        `Section ${section.sectionName} created with ${section.seatsLeft} seats left. Students see it during enrollment.`,
      );
    },
  });
  const update = useMutation({
    mutationFn: ({ sectionId, body }: { sectionId: string; body: SectionUpdate }) =>
      source.updateSection(sectionId, body),
    onSuccess: (section) => {
      remember(section);
      setNotice(
        `Section ${section.sectionName} updated: capacity ${section.capacity}, ${section.seatsLeft} seats left.`,
      );
    },
  });

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (create.isPending) return;
    const next: Partial<Record<keyof Draft, string>> = {};
    if (!draft.courseId) next.courseId = "Choose the course this section offers.";
    if (!draft.sectionName.trim()) next.sectionName = "Enter the section name, such as BSCS 2-1.";
    if (draft.facultyId.trim() && !UUID_PATTERN.test(draft.facultyId.trim()))
      next.facultyId =
        "Enter the faculty member's user ID, a 36-character UUID, or leave it blank.";
    const capacity = wholeNumber(draft.capacity, 1);
    if (capacity === null) next.capacity = "Enter a capacity of at least 1.";
    if (!draft.start || !draft.end || draft.end <= draft.start)
      next.end = "The class must end after it starts.";
    setErrors(next);
    setNotice(null);
    if (Object.keys(next).length || capacity === null) return;
    const room = draft.room.trim() || null;
    create.mutate({
      courseId: draft.courseId,
      sectionName: draft.sectionName.trim(),
      facultyId: draft.facultyId.trim() || null,
      capacity,
      room,
      meetings: [
        {
          dayOfWeek: Number(draft.day),
          startTime: `${draft.start}:00`,
          endTime: `${draft.end}:00`,
          room,
          scheduleType: draft.type,
        },
      ],
    });
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (update.isPending) return;
    const next: { sectionId?: string; capacity?: string } = {};
    if (!UUID_PATTERN.test(edit.sectionId.trim()))
      next.sectionId = "Enter the section ID, a 36-character UUID.";
    const capacity = wholeNumber(edit.capacity, 0);
    if (capacity === null) next.capacity = "Enter the new capacity.";
    setEditErrors(next);
    setNotice(null);
    if (Object.keys(next).length || capacity === null) return;
    const body: SectionUpdate = { capacity };
    if (edit.room.trim()) body.room = edit.room.trim();
    update.mutate({ sectionId: edit.sectionId.trim(), body });
  }

  const createFailure = create.isError ? catalogFailure(create.error) : null;
  const updateFailure = update.isError ? catalogFailure(update.error) : null;
  const err = (key: keyof Draft) =>
    errors[key] && (
      <p id={`${id}-${key}-error`} className={errorText}>
        {errors[key]}
      </p>
    );
  const describe = (key: keyof Draft) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${id}-${key}-error` : undefined,
  });

  return (
    <div className="space-y-6">
      {notice && (
        <p role="status" className={card + " text-brand-success"}>
          {notice}
        </p>
      )}
      <section className={card} aria-labelledby={`${id}-create`}>
        <h2 id={`${id}-create`} className="text-brand-ink text-lg font-bold">
          Create a section
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          The section opens in the current term. Fields marked * are required.
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
              id={`${id}-courseId`}
              text="Course"
              courses={options.data.items}
              value={draft.courseId}
              error={errors.courseId}
              onChange={(value) => set("courseId", value)}
            />
            <div>
              <label htmlFor={`${id}-sectionName`} className={label}>
                Section name <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${id}-sectionName`}
                required
                className={field + " mt-2"}
                value={draft.sectionName}
                {...describe("sectionName")}
                onChange={(event) => set("sectionName", event.target.value)}
              />
              {err("sectionName")}
            </div>
            <div>
              <label htmlFor={`${id}-facultyId`} className={label}>
                Faculty user ID
              </label>
              <input
                id={`${id}-facultyId`}
                className={field + " mt-2"}
                value={draft.facultyId}
                {...describe("facultyId")}
                onChange={(event) => set("facultyId", event.target.value)}
              />
              {err("facultyId")}
            </div>
            <div>
              <label htmlFor={`${id}-capacity`} className={label}>
                Capacity <span aria-hidden="true">*</span>
              </label>
              <input
                id={`${id}-capacity`}
                required
                inputMode="numeric"
                className={field + " mt-2"}
                value={draft.capacity}
                {...describe("capacity")}
                onChange={(event) => set("capacity", event.target.value)}
              />
              {err("capacity")}
            </div>
            <div>
              <label htmlFor={`${id}-room`} className={label}>
                Room
              </label>
              <input
                id={`${id}-room`}
                className={field + " mt-2"}
                value={draft.room}
                onChange={(event) => set("room", event.target.value)}
              />
            </div>
            <fieldset className="border-brand-input-border grid gap-3 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-4">
              <legend className={label + " px-1"}>Weekly schedule</legend>
              <div>
                <label htmlFor={`${id}-day`} className={label}>
                  Day
                </label>
                <select
                  id={`${id}-day`}
                  className={field + " mt-2"}
                  value={draft.day}
                  onChange={(event) => set("day", event.target.value)}
                >
                  {DAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${id}-start`} className={label}>
                  Starts
                </label>
                <input
                  id={`${id}-start`}
                  type="time"
                  className={field + " mt-2"}
                  value={draft.start}
                  onChange={(event) => set("start", event.target.value)}
                />
              </div>
              <div>
                <label htmlFor={`${id}-end`} className={label}>
                  Ends
                </label>
                <input
                  id={`${id}-end`}
                  type="time"
                  className={field + " mt-2"}
                  value={draft.end}
                  {...describe("end")}
                  onChange={(event) => set("end", event.target.value)}
                />
                {err("end")}
              </div>
              <div>
                <label htmlFor={`${id}-type`} className={label}>
                  Type
                </label>
                <select
                  id={`${id}-type`}
                  className={field + " mt-2"}
                  value={draft.type}
                  onChange={(event) =>
                    set("type", event.target.value === "laboratory" ? "laboratory" : "lecture")
                  }
                >
                  <option value="lecture">Lecture</option>
                  <option value="laboratory">Laboratory</option>
                </select>
              </div>
            </fieldset>
            {createFailure && (
              <div role="alert" className="sm:col-span-2">
                <FailureMessage failure={createFailure} />
              </div>
            )}
            <div className="sm:col-span-2">
              <button
                type="submit"
                className={primary}
                disabled={create.isPending}
                aria-busy={create.isPending}
              >
                {create.isPending ? "Creating…" : "Create section"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className={card} aria-labelledby={`${id}-edit`}>
        <h2 id={`${id}-edit`} className="text-brand-ink text-lg font-bold">
          Edit a section
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          Capacity cannot go below the students already enrolled.
        </p>
        <form noValidate onSubmit={submitEdit} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={`${id}-edit-id`} className={label}>
              Section ID <span aria-hidden="true">*</span>
            </label>
            <input
              id={`${id}-edit-id`}
              required
              className={field + " mt-2"}
              value={edit.sectionId}
              aria-invalid={editErrors.sectionId ? true : undefined}
              aria-describedby={editErrors.sectionId ? `${id}-edit-id-error` : undefined}
              onChange={(event) => setEdit({ ...edit, sectionId: event.target.value })}
            />
            {editErrors.sectionId && (
              <p id={`${id}-edit-id-error`} className={errorText}>
                {editErrors.sectionId}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-edit-capacity`} className={label}>
              New capacity <span aria-hidden="true">*</span>
            </label>
            <input
              id={`${id}-edit-capacity`}
              required
              inputMode="numeric"
              className={field + " mt-2"}
              value={edit.capacity}
              aria-invalid={editErrors.capacity || updateFailure ? true : undefined}
              aria-describedby={
                editErrors.capacity
                  ? `${id}-edit-capacity-error`
                  : updateFailure
                    ? `${id}-edit-failure`
                    : undefined
              }
              onChange={(event) => setEdit({ ...edit, capacity: event.target.value })}
            />
            {editErrors.capacity && (
              <p id={`${id}-edit-capacity-error`} className={errorText}>
                {editErrors.capacity}
              </p>
            )}
          </div>
          <div>
            <label htmlFor={`${id}-edit-room`} className={label}>
              New room
            </label>
            <input
              id={`${id}-edit-room`}
              className={field + " mt-2"}
              value={edit.room}
              onChange={(event) => setEdit({ ...edit, room: event.target.value })}
            />
          </div>
          {updateFailure && (
            <div role="alert" className="sm:col-span-3">
              <FailureMessage failure={updateFailure} id={`${id}-edit-failure`} />
            </div>
          )}
          <div className="sm:col-span-3">
            <button
              type="submit"
              className={primary}
              disabled={update.isPending}
              aria-busy={update.isPending}
            >
              {update.isPending ? "Saving…" : "Save section"}
            </button>
          </div>
        </form>
      </section>

      <section className={card} aria-labelledby={`${id}-session`}>
        <h2 id={`${id}-session`} className="text-brand-ink text-lg font-bold">
          Sections changed in this session
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          The catalog service does not list sections yet. Sections you create or edit here appear
          below until you leave the portal.
        </p>
        {created.data.length === 0 ? (
          <p className="text-brand-muted py-4 text-sm">None yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <caption className="sr-only">Sections changed in this session</caption>
              <thead className="bg-brand-maroon text-white">
                <tr>
                  <th scope="col" className="px-3 py-3">
                    Section
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Room
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Capacity
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Enrolled
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Seats left
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {created.data.map((section) => (
                  <tr key={section.id} className="border-brand-border/20 border-b">
                    <th scope="row" className="px-3 py-3 font-semibold">
                      {section.sectionName}
                      <span className="text-brand-muted block text-xs font-normal break-all">
                        {section.id}
                      </span>
                    </th>
                    <td className="px-3 py-3">{section.room ?? "Not set"}</td>
                    <td className="px-3 py-3">{section.capacity}</td>
                    <td className="px-3 py-3">{section.enrolled}</td>
                    <td className="px-3 py-3">{section.seatsLeft}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className={button}
                        aria-label={`Edit section ${section.sectionName}`}
                        onClick={() => {
                          setEdit({
                            sectionId: section.id,
                            capacity: String(section.capacity),
                            room: section.room ?? "",
                          });
                          document.getElementById(`${id}-edit-capacity`)?.focus();
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
