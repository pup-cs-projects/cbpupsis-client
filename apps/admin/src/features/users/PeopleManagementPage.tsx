import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import {
  AdminPage,
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
import { useMe } from "../sign-in/useAdminAuth";
import {
  adminPeopleDataSource,
  adminScope,
  scopeLabel,
  type AdminPeopleDataSource,
  type AdminScope,
  type AssignmentChanges,
  type ManagedPerson,
  type PeopleFilter,
  type PeoplePage,
  type PersonInput,
  type PersonKind,
} from "./dataSource";

function PersonForm({
  kind,
  person,
  busy,
  onSave,
  onCancel,
}: {
  kind: PersonKind;
  person: ManagedPerson | null;
  busy: boolean;
  onSave: (input: PersonInput) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const value = (name: string) => String(form.get(name) ?? "").trim();
        onSave({
          fullName: value("name"),
          email: value("email"),
          institutionalId: value("number"),
          ...(kind === "student"
            ? { programCode: value("program"), yearLevel: Number(value("year")) }
            : {}),
        });
      }}
      className={adminCard + " space-y-4"}
    >
      <h2 className="text-lg font-bold">
        {person ? "Edit" : "Add"} {kind}
      </h2>
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <legend className="sr-only">{kind} account details</legend>
        <Field label="Full name">
          <input
            name="name"
            className={adminField}
            required
            maxLength={255}
            defaultValue={person?.fullName}
          />
        </Field>
        <Field label="Email address">
          <input
            name="email"
            className={adminField}
            type="email"
            required
            defaultValue={person?.email}
          />
        </Field>
        <Field label={kind === "student" ? "Student number" : "Employee ID"}>
          <input
            name="number"
            className={adminField}
            required
            maxLength={50}
            defaultValue={person?.institutionalId}
          />
        </Field>
        {kind === "student" && (
          <>
            <Field label="Program code">
              <input
                name="program"
                className={adminField}
                required
                maxLength={30}
                defaultValue={person?.programCode}
              />
            </Field>
            <Field label="Year level">
              <input
                name="year"
                className={adminField}
                type="number"
                min="1"
                max="6"
                required
                defaultValue={person?.yearLevel ?? 1}
              />
            </Field>
          </>
        )}
      </fieldset>
      <p className="text-brand-muted text-sm">
        The account remains within your authorized college or department. Account setup and
        credentials are handled by the server.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className={adminPrimary} disabled={busy}>
          {busy ? "Saving…" : "Save account"}
        </button>
        <button type="button" className={adminButton} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function AssignmentForm({
  person,
  capabilities,
  busy,
  onSave,
  onCancel,
}: {
  person: ManagedPerson;
  capabilities: PeoplePage["capabilities"];
  busy: boolean;
  onSave: (changes: AssignmentChanges) => void;
  onCancel: () => void;
}) {
  const [roles, setRoles] = useState(person.roleIds);
  const [permissions, setPermissions] = useState(person.permissionIds);
  return (
    <form
      className={adminCard + " space-y-4"}
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          addRoleIds: roles.filter((id) => !person.roleIds.includes(id)),
          removeRoleIds: person.roleIds.filter(
            (id) => capabilities.roles.some((role) => role.id === id) && !roles.includes(id),
          ),
          grantPermissionIds: permissions.filter((id) => !person.permissionIds.includes(id)),
          revokePermissionIds: person.permissionIds.filter(
            (id) =>
              capabilities.permissions.some((permission) => permission.id === id) &&
              !permissions.includes(id),
          ),
        });
      }}
    >
      <h2 className="text-lg font-bold">Roles and permissions for {person.fullName}</h2>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold">Assignable roles</legend>
        {capabilities.roles.map((role) => (
          <label key={role.id} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={roles.includes(role.id)}
              onChange={(event) =>
                setRoles(
                  event.target.checked ? [...roles, role.id] : roles.filter((id) => id !== role.id),
                )
              }
            />
            {role.name}
          </label>
        ))}
      </fieldset>
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold">Assignable permissions</legend>
        {capabilities.permissions.map((permission) => (
          <label key={permission.id} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={permissions.includes(permission.id)}
              onChange={(event) =>
                setPermissions(
                  event.target.checked
                    ? [...permissions, permission.id]
                    : permissions.filter((id) => id !== permission.id),
                )
              }
            />
            {permission.name}
          </label>
        ))}
      </fieldset>
      <p className="text-brand-muted text-sm">
        Only assignments permitted by the server are listed. Existing assignments outside your
        authority are preserved.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className={adminPrimary} disabled={busy}>
          {busy ? "Saving…" : "Save roles and permissions"}
        </button>
        <button type="button" className={adminButton} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
export function PeopleManagementPage({
  kind,
  dataSource = adminPeopleDataSource,
}: {
  kind: PersonKind;
  dataSource?: AdminPeopleDataSource;
}) {
  const me = useMe();
  let scope: AdminScope | null = null;
  if (me.data) {
    try {
      scope = adminScope(me.data);
    } catch {
      /* No fallback to institution scope. */
    }
  }
  const title = kind === "student" ? "Student Management" : "Faculty Management";
  const [filter, setFilter] = useState<PeopleFilter>({
    search: "",
    active: "all",
    limit: 20,
    offset: 0,
  });
  const [editing, setEditing] = useState<ManagedPerson | null | undefined>();
  const [assigning, setAssigning] = useState<ManagedPerson | null>(null);
  const [notice, setNotice] = useState("");
  const list = useAdminQuery(
    ["people", kind, scope, filter],
    (signal) => dataSource.list(kind, scope!, filter, signal),
    Boolean(dataSource.available && scope),
  );
  const save = useMutation({
    retry: false,
    mutationFn: (input: PersonInput) => dataSource.save(kind, scope!, input, editing?.id),
    onSuccess: () => {
      setEditing(undefined);
      setNotice("Account saved.");
      void list.refetch();
    },
  });
  const assign = useMutation({
    retry: false,
    mutationFn: (changes: AssignmentChanges) =>
      dataSource.assign(kind, scope!, assigning!.id, changes),
    onSuccess: () => {
      setAssigning(null);
      setNotice("Roles and permissions saved.");
      void list.refetch();
    },
  });
  const canCreate = Boolean(scope && list.data?.capabilities.create);
  return (
    <AdminPage
      title={title}
      description={`Manage ${kind} accounts, roles, and permissions within your authorized scope.`}
    >
      {!scope ? (
        <p role="alert">
          This page is not available until your college or department scope is configured.
        </p>
      ) : (
        <>
          <p className={adminCard + " text-sm font-semibold"}>{scopeLabel(scope)}</p>
          {!dataSource.available && (
            <p role="status" className={adminCard + " text-sm leading-relaxed"}>
              {title} is not available yet. Account and permission changes are disabled. Contact
              your system administrator for assistance.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={adminPrimary}
              disabled={!canCreate}
              onClick={() => {
                setAssigning(null);
                setEditing(null);
                save.reset();
              }}
            >
              Add {kind}
            </button>
          </div>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter({
                ...filter,
                search: String(new FormData(event.currentTarget).get("search") ?? "").trim(),
                offset: 0,
              });
            }}
          >
            <Field label={`Search ${kind} accounts`}>
              <input
                name="search"
                className={adminField}
                maxLength={100}
                disabled={!dataSource.available}
                placeholder="Name, number, or email"
              />
            </Field>
            <Field label="Account status">
              <select
                className={adminField}
                disabled={!dataSource.available}
                value={filter.active}
                onChange={(event) =>
                  setFilter({
                    ...filter,
                    active: event.target.value as PeopleFilter["active"],
                    offset: 0,
                  })
                }
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <button className={adminButton} disabled={!dataSource.available}>
              Search
            </button>
          </form>
          {notice && <p role="status">{notice}</p>}
          {editing !== undefined &&
            (editing ? list.data?.capabilities.edit : list.data?.capabilities.create) && (
              <PersonForm
                key={editing?.id ?? "new"}
                kind={kind}
                person={editing}
                busy={save.isPending}
                onCancel={() => setEditing(undefined)}
                onSave={(input) => save.mutate(input)}
              />
            )}
          {editing !== undefined && save.isError && <ApiFailure error={save.error} />}
          {assigning && list.data?.capabilities.assignRoles && (
            <AssignmentForm
              key={assigning.id}
              person={assigning}
              capabilities={list.data.capabilities}
              busy={assign.isPending}
              onCancel={() => setAssigning(null)}
              onSave={(changes) => assign.mutate(changes)}
            />
          )}
          {assigning && assign.isError && <ApiFailure error={assign.error} />}
          {dataSource.available && list.isPending && <p role="status">Loading {kind} accounts…</p>}
          {list.isError && <ApiFailure error={list.error} retry={() => void list.refetch()} />}
          {list.data && (
            <>
              <AdminTable
                caption={`${title} directory`}
                headings={["Name", "Number", "Email", "Status", "Actions"]}
              >
                {list.data.items.map((person) => (
                  <tr key={person.id}>
                    <th scope="row" className="px-4 py-4">
                      {person.fullName}
                    </th>
                    <td className="px-4 py-4">{person.institutionalId}</td>
                    <td className="px-4 py-4 break-all">{person.email}</td>
                    <td className="px-4 py-4">{person.active ? "Active" : "Inactive"}</td>
                    <td className="space-y-2 px-4 py-4">
                      {list.data.capabilities.edit && (
                        <button
                          type="button"
                          className={adminButton}
                          onClick={() => {
                            setAssigning(null);
                            setEditing(person);
                            save.reset();
                          }}
                        >
                          Edit {person.fullName}
                        </button>
                      )}
                      {list.data.capabilities.assignRoles && (
                        <button
                          type="button"
                          className={adminButton}
                          onClick={() => {
                            setEditing(undefined);
                            setAssigning(person);
                            assign.reset();
                          }}
                        >
                          Roles and permissions: {person.fullName}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </AdminTable>
              {!list.data.items.length && <p>No {kind} accounts match your filters.</p>}
              <Pagination
                offset={filter.offset}
                total={list.data.total}
                busy={list.isFetching}
                onChange={(offset) => setFilter({ ...filter, offset })}
              />
            </>
          )}
        </>
      )}
    </AdminPage>
  );
}
export function StudentManagementPage() {
  return <PeopleManagementPage kind="student" />;
}
export function FacultyManagementPage() {
  return <PeopleManagementPage kind="faculty" />;
}
