import { useQuery } from "@tanstack/react-query";
import { useMe } from "../features/sign-in/useAdminAuth";
import { session } from "./auth";

export function useAdminQuery<T>(
  key: readonly unknown[],
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const me = useMe();
  return useQuery({
    queryKey: ["admin-operations", me.data?.id, ...key],
    queryFn: ({ signal }) => load(signal),
    enabled: enabled && me.isSuccess && session.isSignedIn(),
    retry: false,
    refetchOnWindowFocus: false,
  });
}
export function localDate(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
