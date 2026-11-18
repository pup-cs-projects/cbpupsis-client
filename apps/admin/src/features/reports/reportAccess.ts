import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "../sign-in/useAdminAuth";

export function canReadEnrollmentReport(position: string | undefined) {
  // Published ADMIN_POSITION_POLICIES grant ReadEnrollmentReport to these positions.
  // The actual report API remains authoritative and a 403 removes the tab immediately.
  return position === "chairperson" || position === "dean" || position === "registrar";
}
export const reportKeys = {
  access: (id: string | undefined) => ["admin-reports", id, "access"] as const,
  user: (id: string | undefined) => ["admin-reports", id] as const,
};
export function useReportAccess() {
  const me = useMe();
  const client = useQueryClient();
  const access = useQuery<boolean>({
    queryKey: reportKeys.access(me.data?.id),
    queryFn: () => true,
    enabled: false,
    initialData: true,
  });
  const deny = useCallback(
    () => client.setQueryData(reportKeys.access(me.data?.id), false),
    [client, me.data?.id],
  );
  return {
    allowed: me.isSuccess && canReadEnrollmentReport(me.data.position) && access.data,
    deny,
  };
}
