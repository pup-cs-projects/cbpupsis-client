import type { AdminPosition } from "@cbpupsis/shared/auth";

/**
 * Only Finance may open the fee structure page. The API grants `ManageFeeStructure` through the
 * `FeeStructureAdmin` policy, which `ADMIN_POSITION_POLICIES` gives to the `finance` position
 * alone; Registrar, Dean, and Chair get 403 `AUTH_INSUFFICIENT_ROLE` (AC-FIN-003.8). `/admin/me`
 * returns the position, not the permissions, so the position is what the client can check.
 */
export function canManageFees(position: AdminPosition | undefined): boolean {
  return position === "finance";
}
