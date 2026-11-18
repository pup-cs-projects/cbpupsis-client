import type { AdminProfile } from "@cbpupsis/shared/auth";

export function canReadCatalog(position: string | undefined) {
  return position === "chairperson" || position === "dean" || position === "registrar";
}
export function catalogScope(profile: AdminProfile | undefined) {
  if (profile?.position === "registrar") return "All colleges and departments";
  if (profile?.position === "dean")
    return profile.collegeId ? `College: ${profile.collegeId}` : "College scope is not configured";
  if (profile?.position === "chairperson")
    return profile.departmentId
      ? `Department: ${profile.departmentId}`
      : "Department scope is not configured";
  return "No catalog access";
}
