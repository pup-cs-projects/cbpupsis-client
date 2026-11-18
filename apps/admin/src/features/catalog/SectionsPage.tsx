import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  ApiFailure,
  Field,
  adminButton,
  adminCard,
  adminField,
  adminPrimary,
  uuidPattern,
} from "../../components/AdminPage";
import { useAdminQuery } from "../../lib/adminQueries";
import type { SectionInput } from "@cbpupsis/shared/catalog/admin";
import { catalogApi } from "./api";
import { CatalogError } from "./CatalogError";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export function SectionsPanel({ canEdit }: { canEdit: boolean }) {
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const [meetings, setMeetings] = useState<number[]>([1]);
  const [serial, setSerial] = useState(2);
  const courses = useAdminQuery(
    ["section-courses", search],
    (signal) => catalogApi.courses(search, 0, signal),
    canEdit,
  );
  const save = useMutation({
    mutationFn: ({ input, id }: { input: SectionInput; id?: string }) =>
      catalogApi.saveSection(input, id),
    retry: false,
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const slots = meetings.map((key) => ({
      dayOfWeek: Number(value(`day-${key}`)),
      startTime: value(`start-${key}`),
      endTime: value(`end-${key}`),
      room: value(`room-${key}`) || null,
      scheduleType: value(`type-${key}`),
    }));
    if (slots.some((slot) => slot.endTime <= slot.startTime)) {
      setTimeError("Each meeting must end after its start time.");
      return;
    }
    setTimeError("");
    save.mutate({
      id: updating ? value("sectionId") : undefined,
      input: {
        courseId: value("courseId"),
        sectionName: value("sectionName"),
        capacity: Number(value("capacity")),
        ...(value("term") ? { academicTermId: value("term") } : {}),
        ...(value("faculty") ? { facultyId: value("faculty") } : {}),
        room: value("room") || null,
        meetings: slots,
        replaceMeetings: !updating || form.has("replaceMeetings"),
      },
    });
  }
  const [timeError, setTimeError] = useState("");
  if (!canEdit)
    return (
      <section className={adminCard}>
        <h2 className="text-xl font-bold">Section management</h2>
        <p className="text-brand-muted mt-3 text-sm">
          Existing sections are not available for browsing yet. Your account has read-only access.
        </p>
      </section>
    );
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-bold">Section management</h2>
      <p className="text-brand-muted text-sm">
        Existing sections cannot be browsed yet. Use an existing section reference to update a
        section.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Section operation">
        <button
          type="button"
          className={adminButton}
          aria-pressed={!updating}
          onClick={() => {
            setUpdating(false);
            save.reset();
          }}
        >
          Create section
        </button>
        <button
          type="button"
          className={adminButton}
          aria-pressed={updating}
          onClick={() => {
            setUpdating(true);
            save.reset();
          }}
        >
          Update section
        </button>
      </div>
      {!updating && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(String(new FormData(event.currentTarget).get("search")).trim());
          }}
        >
          <Field label="Find a course">
            <input name="search" className={adminField} maxLength={100} />
          </Field>
          <button className={adminButton}>Find courses</button>
        </form>
      )}
      {courses.isError && !updating && (
        <ApiFailure error={courses.error} retry={() => void courses.refetch()} />
      )}
      <form key={String(updating)} onSubmit={submit} className={adminCard + " space-y-5"}>
        <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="sr-only">Section details</legend>
          {updating ? (
            <Field label="Existing section reference">
              <input
                name="sectionId"
                className={adminField}
                required
                pattern={uuidPattern}
                defaultValue={save.data?.id}
              />
            </Field>
          ) : (
            <Field label="Course">
              <select name="courseId" className={adminField} required defaultValue="">
                <option value="">Select a course</option>
                {courses.data?.items.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} · {course.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Section name">
            <input name="sectionName" className={adminField} maxLength={30} required />
          </Field>
          <Field label="Capacity">
            <input
              name="capacity"
              className={adminField}
              required
              type="number"
              min={updating ? 0 : 1}
              step="1"
            />
          </Field>
          {!updating && (
            <Field label="Academic term reference (optional)">
              <input
                name="term"
                className={adminField}
                pattern={uuidPattern}
                aria-describedby="section-term-help"
              />
            </Field>
          )}
          <Field label="Faculty account reference (optional)">
            <input name="faculty" className={adminField} pattern={uuidPattern} />
          </Field>
          <Field label="Room (optional)">
            <input name="room" className={adminField} maxLength={100} />
          </Field>
        </fieldset>
        <p id="section-term-help" className="text-brand-muted text-sm">
          For a new section, leave the academic term blank to use the configured current term.
          Obtain existing section and faculty references from your academic records.
        </p>
        {updating && (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="replaceMeetings" className="accent-brand-maroon size-4" />
            Replace this section's meeting schedule with the entries below
          </label>
        )}
        <fieldset disabled={save.isPending} className="min-w-0 space-y-3">
          <legend className="font-semibold">Meeting schedule</legend>
          {meetings.map((key, index) => (
            <div
              key={key}
              className="border-brand-border/25 grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-2"
            >
              <Field label={`Meeting ${index + 1} day`}>
                <select name={`day-${key}`} className={adminField}>
                  {days.map((day, dayIndex) => (
                    <option key={day} value={dayIndex}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Meeting ${index + 1} type`}>
                <select name={`type-${key}`} className={adminField}>
                  <option value="lecture">Lecture</option>
                  <option value="lab">Laboratory</option>
                </select>
              </Field>
              <Field label={`Meeting ${index + 1} starts`}>
                <input
                  type="time"
                  name={`start-${key}`}
                  className={adminField}
                  required
                  defaultValue="08:00"
                />
              </Field>
              <Field label={`Meeting ${index + 1} ends`}>
                <input
                  type="time"
                  name={`end-${key}`}
                  className={adminField}
                  required
                  defaultValue="10:00"
                />
              </Field>
              <Field label={`Meeting ${index + 1} room`}>
                <input name={`room-${key}`} className={adminField} maxLength={100} />
              </Field>
              <button
                type="button"
                className={adminButton}
                onClick={() => setMeetings((rows) => rows.filter((item) => item !== key))}
              >
                Remove meeting {index + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className={adminButton}
            onClick={() => {
              setMeetings((rows) => [...rows, serial]);
              setSerial(serial + 1);
            }}
          >
            Add meeting
          </button>
        </fieldset>
        {timeError && (
          <p role="alert" className="text-brand-maroon">
            {timeError}
          </p>
        )}
        {save.isError && <CatalogError error={save.error} />}
        {save.data && (
          <p role="status">
            Section {save.data.sectionName} saved. Reference:{" "}
            <span className="break-all">{save.data.id}</span>
          </p>
        )}
        <button
          className={adminPrimary}
          disabled={save.isPending || (!updating && !courses.isSuccess)}
        >
          {save.isPending ? "Saving…" : "Save section"}
        </button>
      </form>
    </section>
  );
}
