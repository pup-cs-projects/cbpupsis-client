import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import type { FacultyProfile, NotificationPreference } from "@cbpupsis/shared/profile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BriefcaseBusiness, LockKeyhole, UserRound } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { facultyProfileApi, session } from "../../lib/auth";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { gradeButton, gradeCard, gradeField, gradePrimary } from "../grades/gradeStyles";
import { useMe } from "../sign-in/useFacultyAuth";

const labels: Record<string, string> = {
  fullName: "Full name",
  employeeId: "Employee ID",
  department: "Department",
  title: "Title / rank",
  officeLocation: "Office location",
  officeHours: "Office hours",
  qualifications: "Qualifications",
};
const fieldLabel = (name: string) =>
  labels[name] ??
  name
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (s) => s.toUpperCase());
export function ProfilePage() {
  const me = useMe();
  const query = useQuery({
    queryKey: ["faculty-profile", me.data?.id],
    queryFn: ({ signal }) => session.authorized((token) => facultyProfileApi.get(token, signal)),
    enabled: me.isSuccess,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const error = me.error ?? query.error;
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <header>
          <p className="text-brand-muted text-sm">Settings / Profile</p>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold">Account settings</h1>
          <p className="text-brand-muted mt-2">
            Manage your professional profile, notifications, and password.
          </p>
        </header>
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {error ? (
              <section className={gradeCard} role="alert" aria-label="Profile unavailable">
                <h2 className="text-xl font-bold">Profile unavailable</h2>
                <p className="text-brand-muted mt-3 leading-relaxed">
                  {error instanceof ApiError && error.status === 403
                    ? "Your account does not have permission to view the faculty profile. Contact your administrator to restore profile access."
                    : errorMessage(error)}
                </p>
                <button
                  className={gradeButton + " mt-4"}
                  onClick={() => void (me.isError ? me.refetch() : query.refetch())}
                >
                  Retry profile
                </button>
              </section>
            ) : query.data && me.data ? (
              <ProfileEditor key={me.data.id} initial={query.data} owner={me.data.id} />
            ) : (
              <p role="status">Loading faculty profile…</p>
            )}
          </div>
          {me.data && (
            <div className="min-w-0 space-y-6">
              <NotificationSettings owner={me.data.id} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
function ProfileEditor({ initial, owner }: { initial: FacultyProfile; owner: string }) {
  const client = useQueryClient();
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      Object.entries(initial.fields).map(([key, field]) => [key, field.value ?? ""]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const dirty = Object.entries(initial.fields).some(
    ([key, field]) => field.editable && values[key] !== (field.value ?? ""),
  );
  async function save(event: FormEvent) {
    event.preventDefault();
    if (running.current || !dirty) return;
    const changes = Object.fromEntries(
      Object.entries(initial.fields)
        .filter(([key, field]) => field.editable && values[key] !== (field.value ?? ""))
        .map(([key]) => [key, values[key]!.trim()]),
    );
    const invalid = Object.fromEntries(
      Object.entries(changes)
        .filter(([, value]) => !value)
        .map(([key]) => [key, "Enter a value for this field."]),
    );
    setErrors(invalid);
    setNotice(null);
    setFailure(null);
    if (Object.keys(invalid).length) return;
    running.current = true;
    setBusy(true);
    try {
      const saved = await session.authorized((token) => facultyProfileApi.update(token, changes));
      client.setQueryData(["faculty-profile", owner], saved);
      setValues(
        Object.fromEntries(
          Object.entries(saved.fields).map(([key, field]) => [key, field.value ?? ""]),
        ),
      );
      setNotice("Profile saved.");
    } catch (error) {
      if (error instanceof ApiError && error.code === "PROFILE_FIELD_LOCKED") {
        const locked = Array.isArray(error.details?.lockedFields)
          ? error.details.lockedFields.filter((v): v is string => typeof v === "string")
          : [];
        setFailure(
          locked.length
            ? `These fields are locked: ${locked.map(fieldLabel).join(", ")}.`
            : "These fields are locked. Reload the profile before editing.",
        );
        setErrors(
          Object.fromEntries(
            locked.map((key) => [key, "Locked. Contact the Registrar to request a correction."]),
          ),
        );
      } else if (
        error instanceof ApiError &&
        error.status === 422 &&
        error.details?.errors &&
        typeof error.details.errors === "object"
      ) {
        setErrors(
          Object.fromEntries(
            Object.entries(error.details.errors).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          ),
        );
        setFailure("Check the highlighted fields.");
      } else if (error instanceof ApiError && error.status === 403) {
        setFailure(
          "Your account does not have permission to update the faculty profile. Contact your administrator to restore editing access.",
        );
      } else setFailure(errorMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="space-y-6" onSubmit={(e) => void save(e)} noValidate>
      {[
        {
          title: "Profile information",
          icon: <UserRound className="size-5" aria-hidden="true" />,
          professional: false,
        },
        {
          title: "Professional details",
          icon: <BriefcaseBusiness className="size-5" aria-hidden="true" />,
          professional: true,
        },
      ].map((group) => {
        const fields = Object.entries(initial.fields).filter(
          ([key]) =>
            ["officeLocation", "officeHours", "qualifications"].includes(key) ===
            group.professional,
        );
        if (!fields.length) return null;
        return (
          <section key={group.title} className={gradeCard}>
            <h2 className="text-brand-maroon flex items-center gap-3 text-xl font-bold">
              {group.icon}
              {group.title}
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {fields.map(([key, field]) => (
                <div key={key} className={key === "qualifications" ? "sm:col-span-2" : "min-w-0"}>
                  <label className="block text-sm font-medium" htmlFor={`profile-${key}`}>
                    {fieldLabel(key)}
                  </label>
                  <input
                    id={`profile-${key}`}
                    className={gradeField + " mt-2 read-only:bg-neutral-50"}
                    value={values[key] ?? ""}
                    readOnly={!field.editable}
                    disabled={busy}
                    onChange={(e) => {
                      setValues({ ...values, [key]: e.target.value });
                      setErrors({ ...errors, [key]: "" });
                      setNotice(null);
                    }}
                    aria-invalid={!!errors[key]}
                    aria-describedby={
                      !field.editable || errors[key] ? `profile-help-${key}` : undefined
                    }
                  />
                  {!field.editable && (
                    <p
                      id={`profile-help-${key}`}
                      className="text-brand-muted mt-2 flex items-center gap-1.5 text-xs"
                    >
                      <LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />
                      Locked · Contact the Registrar for a records correction.
                    </p>
                  )}
                  {errors[key] && (
                    <p
                      id={field.editable ? `profile-help-${key}` : undefined}
                      role="alert"
                      className="mt-2 text-sm text-red-700"
                    >
                      {errors[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {!Object.keys(initial.fields).length && (
        <p className={gradeCard}>No profile fields are available.</p>
      )}
      {failure && (
        <p role="alert" className="mt-5 text-sm text-red-700">
          {failure}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-5 text-sm">
          {notice}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button className={gradePrimary} disabled={!dirty || busy}>
          {busy ? "Saving profile…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}
function NotificationSettings({ owner }: { owner: string }) {
  const query = useQuery({
    queryKey: ["faculty-notifications", owner],
    queryFn: ({ signal }) =>
      session.authorized((token) => facultyProfileApi.preferences(token, signal)),
    retry: false,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const running = useRef(false);
  async function toggle(preference: NotificationPreference) {
    if (running.current) return;
    running.current = true;
    setBusy(`${preference.type}:${preference.channel}`);
    setFailure(null);
    setNotice(null);
    try {
      await session.authorized((token) =>
        facultyProfileApi.setPreference(token, { ...preference, enabled: !preference.enabled }),
      );
      await query.refetch();
      setNotice("Notification preference saved.");
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setBusy(null);
      running.current = false;
    }
  }
  return (
    <section className={gradeCard} aria-labelledby="notification-heading">
      <h2 id="notification-heading" className="flex items-center gap-3 text-xl font-bold">
        <Bell className="text-brand-maroon size-5" aria-hidden="true" />
        Notifications
      </h2>
      <p className="text-brand-muted mt-2 text-sm">
        Choose which notices you receive. Required notices stay enabled.
      </p>
      {query.isPending ? (
        <p role="status" className="mt-4">
          Loading notification preferences…
        </p>
      ) : query.error ? (
        <div role="alert" className="mt-4">
          <p>{errorMessage(query.error)}</p>
          <button className={gradeButton + " mt-3"} onClick={() => void query.refetch()}>
            Retry preferences
          </button>
        </div>
      ) : !query.data.length ? (
        <p className="mt-4">No notification preferences are available.</p>
      ) : (
        <ul className="mt-4 divide-y divide-neutral-200">
          {query.data.map((item) => {
            const key = `${item.type}:${item.channel}`;
            return (
              <li key={key} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p id={`preference-${key}`} className="text-sm font-semibold break-words">
                    {fieldLabel(item.type.replaceAll(".", " "))}
                  </p>
                  <p className="text-brand-muted mt-1 text-xs">
                    {item.channel === "email" ? "Email" : "In-app"}
                    {!item.editable ? " · Required" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.enabled}
                  aria-label={`${fieldLabel(item.type.replaceAll(".", " "))} ${item.channel === "email" ? "email" : "in-app"}`}
                  className="focus-visible:outline-brand-maroon inline-flex min-h-11 min-w-16 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!item.editable || !!busy}
                  onClick={() => void toggle(item)}
                >
                  <span
                    aria-hidden="true"
                    className={
                      "inline-flex h-7 w-12 items-center rounded-full border p-0.5 transition-colors motion-reduce:transition-none " +
                      (item.enabled
                        ? "border-brand-maroon bg-brand-maroon"
                        : "border-neutral-300 bg-neutral-200")
                    }
                  >
                    <span
                      className={
                        "size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none " +
                        (item.enabled ? "translate-x-5" : "translate-x-0")
                      }
                    />
                  </span>
                  <span className="sr-only">
                    {busy === key ? "Saving…" : item.enabled ? "On" : "Off"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {failure && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {failure} Try changing the preference again.
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-sm">
          {notice}
        </p>
      )}
    </section>
  );
}
