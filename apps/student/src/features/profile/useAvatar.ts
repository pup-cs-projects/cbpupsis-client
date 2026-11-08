import { useQuery } from "@tanstack/react-query";

import { profileApi, session } from "../../lib/auth";

export const profileKeys = {
  all: ["profile"] as const,
  profile: () => [...profileKeys.all, "profile"] as const,
  account: () => [...profileKeys.all, "account"] as const,
  contacts: () => [...profileKeys.all, "contacts"] as const,
  avatar: (url: string) => [...profileKeys.all, "avatar", url] as const,
};

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The picture could not be read"));
    reader.readAsDataURL(blob);
  });
}

/**
 * The stored picture as a data URL. It needs the bearer token, so it cannot be an `<img src>`
 * of its own; a data URL, unlike an object URL, has nothing to revoke. Null until it loads, or
 * when it fails, so the placeholder shows.
 */
export function useAvatarSrc(avatarUrl: string | null): string | null {
  const { data } = useQuery({
    queryKey: profileKeys.avatar(avatarUrl ?? ""),
    queryFn: async () =>
      toDataUrl(await session.authorized((token) => profileApi.avatar(token, avatarUrl ?? ""))),
    enabled: avatarUrl !== null,
    staleTime: Infinity,
    retry: false,
  });
  return avatarUrl === null ? null : (data ?? null);
}
