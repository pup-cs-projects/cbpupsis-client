import { useQuery } from "@tanstack/react-query";
import { session } from "../../lib/auth";
import { useMe } from "../sign-in/useAdminAuth";
import { catalogApi } from "./api";
import { canReadCatalog } from "./catalogRules";

/** The authenticated catalog response establishes ReadCatalog without querying Superadmin IAM. */
export function useCatalogAccess() {
  const me = useMe();
  const eligible = canReadCatalog(me.data?.position);
  const query = useQuery({
    queryKey: ["admin-catalog-access", me.data?.id],
    queryFn: ({ signal }) => catalogApi.courses("", 0, signal, 1),
    enabled: eligible && me.isSuccess && session.isSignedIn(),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return { eligible, readable: eligible && query.isSuccess, query };
}
