import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import type { AdminPosition } from "@cbpupsis/shared/auth";

/** Positions that may open `/catalog`. The API still scopes and refuses every call. */
export const CATALOG_ROLES = ["chairperson", "dean", "registrar"] as const;
export type CatalogRole = (typeof CATALOG_ROLES)[number];

export function isCatalogRole(value: AdminPosition | undefined): value is CatalogRole {
  return CATALOG_ROLES.includes(value as CatalogRole);
}

/** Only the Department Chair changes the catalog; Deans and the Registrar read. */
export function canEditCatalog(role: CatalogRole): boolean {
  return role === "chairperson";
}

export const SCOPE_TEXT: Record<CatalogRole, string> = {
  chairperson: "Courses, curricula, and sections of your department. You can add and edit them.",
  dean: "Courses of the departments in your college. Read only.",
  registrar: "Courses of every department. Read only.",
};

export const button =
  "focus-visible:outline-offset-0! inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-brand-border/40 bg-white px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-brand-paper disabled:cursor-not-allowed disabled:opacity-50";
export const primary =
  button + " border-brand-maroon! bg-brand-maroon! text-white! hover:bg-brand-maroon-dark!";
export const card =
  "border-brand-border/25 min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-6";
export const field =
  "border-brand-input-border focus-visible:outline-offset-0! min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm text-brand-input-text";
export const label = "block text-sm font-medium text-brand-ink";
export const errorText = "text-brand-crimson mt-1 text-sm";

export interface CatalogFailure {
  message: string;
  requestId?: string;
  /** Set when the refusal belongs next to the prerequisite fields. */
  field?: "prerequisites";
}

/** "A requires B requires A", from the cycle the API names in `details.cycle`. */
export function describeCycle(error: ApiError): string | null {
  const cycle = error.details?.cycle;
  if (!Array.isArray(cycle) || cycle.length < 2) return null;
  const codes = cycle.filter((code): code is string => typeof code === "string");
  return codes.length === cycle.length ? codes.join(" requires ") : null;
}

/** What a refused catalog change shows. Branches on `code`, never on the API's wording. */
export function catalogFailure(error: unknown): CatalogFailure {
  if (!(error instanceof ApiError)) return { message: errorMessage(error) };
  const requestId = error.requestId;
  switch (error.code) {
    case "CATALOG_PREREQUISITE_CYCLE": {
      const cycle = describeCycle(error);
      return {
        message: cycle
          ? `These requisites form a cycle: ${cycle}. Remove one link, then save again.`
          : errorMessage(error),
        requestId,
        field: "prerequisites",
      };
    }
    case "CATALOG_VERSION_IN_USE":
      return {
        message:
          error.detail ?? "Students are bound to this curriculum version, so it cannot be deleted.",
        requestId,
      };
    case "SECTION_CAPACITY_BELOW_ENROLLED": {
      const enrolled = error.details?.enrolled;
      return {
        message:
          error.detail ??
          (typeof enrolled === "number"
            ? `Capacity cannot go below the ${enrolled} students already enrolled.`
            : "Capacity cannot go below the students already enrolled."),
        requestId,
      };
    }
    case "RESOURCE_NOT_FOUND":
      return { message: "That record was not found in your scope.", requestId };
  }
  if (error.status === 403)
    return { message: "Your account cannot change this part of the catalog.", requestId };
  if (error.status === 404)
    return { message: "That record was not found in your scope.", requestId };
  return { message: errorMessage(error), requestId };
}

/** True when the API refuses the page itself, as opposed to one change. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Splits a pasted list of ids on commas, spaces, or new lines. */
export function splitIds(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
