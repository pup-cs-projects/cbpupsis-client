import { ApiError } from "@cbpupsis/shared/api";
import { adminApiMessage } from "../../lib/adminApi";

function catalogError(error: unknown): string {
  if (error instanceof ApiError) {
    const cycle = error.details?.cycle;
    if (
      error.code === "CATALOG_PREREQUISITE_CYCLE" &&
      Array.isArray(cycle) &&
      cycle.length &&
      cycle.every((item) => typeof item === "string")
    )
      return cycle.join(" requires ");
    if (error.code === "CATALOG_VERSION_IN_USE")
      return (
        error.detail ?? "This curriculum version is used by student records and cannot be deleted."
      );
    if (error.code === "SECTION_CAPACITY_BELOW_ENROLLED")
      return error.detail ?? "Capacity cannot be lower than the number of enrolled students.";
  }
  return adminApiMessage(error);
}
export function CatalogError({ error, id }: { error: unknown; id?: string }) {
  return (
    <p id={id} role="alert" className="text-brand-maroon mt-2 text-sm leading-relaxed">
      {catalogError(error)}
    </p>
  );
}
