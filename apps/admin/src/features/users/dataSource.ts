import { ApiError } from "@cbpupsis/shared/api";
import type { AdminProfile } from "@cbpupsis/shared/auth";

export type PersonKind = "student" | "faculty";
export type AdminScope =
  | { kind: "institution" }
  | { kind: "college"; collegeId: string }
  | { kind: "department"; departmentId: string };
export interface PersonInput {
  fullName: string;
  email: string;
  institutionalId: string;
  programCode?: string;
  yearLevel?: number;
}
export interface ManagedPerson extends PersonInput {
  id: string;
  kind: PersonKind;
  departmentId: string;
  collegeId: string;
  active: boolean;
  roleIds: string[];
  permissionIds: string[];
}
export interface GrantChoice {
  id: string;
  name: string;
}
export interface PeoplePage {
  items: ManagedPerson[];
  total: number;
  capabilities: {
    create: boolean;
    edit: boolean;
    assignRoles: boolean;
    roles: GrantChoice[];
    permissions: GrantChoice[];
  };
}
export interface AssignmentChanges {
  addRoleIds: string[];
  removeRoleIds: string[];
  grantPermissionIds: string[];
  revokePermissionIds: string[];
}
export interface PeopleFilter {
  search: string;
  active: "all" | "active" | "inactive";
  limit: number;
  offset: number;
}
export interface AdminPeopleTransport {
  list(
    kind: PersonKind,
    scope: AdminScope,
    filter: PeopleFilter,
    signal: AbortSignal,
  ): Promise<PeoplePage>;
  save(
    kind: PersonKind,
    scope: AdminScope,
    input: PersonInput,
    id?: string,
  ): Promise<ManagedPerson>;
  assign(
    kind: PersonKind,
    scope: AdminScope,
    id: string,
    changes: AssignmentChanges,
  ): Promise<ManagedPerson>;
}
export type AdminPeopleDataSource = AdminPeopleTransport & { available: boolean };

export function adminScope(profile: AdminProfile): AdminScope {
  if (profile.position === "registrar") return { kind: "institution" };
  if (profile.position === "dean" && profile.collegeId?.trim())
    return { kind: "college", collegeId: profile.collegeId };
  if (profile.position === "chairperson" && profile.departmentId?.trim())
    return { kind: "department", departmentId: profile.departmentId };
  throw new ApiError(403, "ADMIN_SCOPE_REQUIRED");
}
export function scopeLabel(scope: AdminScope) {
  return scope.kind === "institution"
    ? "All colleges and departments"
    : scope.kind === "college"
      ? `College: ${scope.collegeId}`
      : `Department: ${scope.departmentId}`;
}
function validatePerson(person: ManagedPerson, kind: PersonKind, scope: AdminScope) {
  if (
    person.kind !== kind ||
    (scope.kind === "college" && person.collegeId !== scope.collegeId) ||
    (scope.kind === "department" && person.departmentId !== scope.departmentId)
  )
    throw new ApiError(0, "INVALID_RESPONSE");
  return person;
}
/** Wire the future authenticated scoped API here. No Superadmin endpoint is used as a fallback. */
export function createAdminPeopleDataSource(
  transport: AdminPeopleTransport,
): AdminPeopleDataSource {
  return {
    available: true,
    async list(kind, scope, filter, signal) {
      const page = await transport.list(kind, scope, filter, signal);
      if (
        !Number.isSafeInteger(page.total) ||
        (page.total < page.items.length + filter.offset && page.items.length > 0) ||
        page.total < 0 ||
        page.items.length > filter.limit ||
        new Set(page.items.map((p) => p.id)).size !== page.items.length
      )
        throw new ApiError(0, "INVALID_RESPONSE");
      return { ...page, items: page.items.map((person) => validatePerson(person, kind, scope)) };
    },
    async save(kind, scope, input, id) {
      return validatePerson(await transport.save(kind, scope, input, id), kind, scope);
    },
    async assign(kind, scope, id, changes) {
      return validatePerson(await transport.assign(kind, scope, id, changes), kind, scope);
    },
  };
}
const unavailable = async (): Promise<never> => {
  throw new ApiError(503, "ADMIN_PEOPLE_NOT_CONFIGURED");
};
export const adminPeopleDataSource: AdminPeopleDataSource = {
  available: false,
  list: unavailable,
  save: unavailable,
  assign: unavailable,
};
