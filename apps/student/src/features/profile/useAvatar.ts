import { queryOptions, useQuery } from "@tanstack/react-query";

import { profileApi, session } from "../../lib/auth";

export const profileKeys = {
  all: ["profile"] as const,
  profile: () => [...profileKeys.all, "profile"] as const,
  account: () => [...profileKeys.all, "account"] as const,
  contacts: () => [...profileKeys.all, "contacts"] as const,
  avatar: (url: string) => [...profileKeys.all, "avatar", url] as const,
};

/**
 * What both the profile page and the header show when the student has no photo (or while it
 * loads): the same local portrait, served from the app's own origin.
 */
export const AVATAR_PLACEHOLDER = "/assets/profile-placeholder.webp";

/**
 * The student's profile (GET /student/profile). The profile page and the header read it through
 * this one query, so both see the same photo: an upload is written to the profile, and the
 * dashboard reads a different record that it does not always reach.
 */
export const profileQueryOptions = () =>
  queryOptions({
    queryKey: profileKeys.profile(),
    queryFn: () => session.authorized((token) => profileApi.get(token)),
  });

// Every page's header reads the profile; keeping it fresh for a minute means moving between pages
// reuses it instead of asking the API again each time.
const PROFILE_FRESH_FOR_MS = 60_000;

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

/**
 * The picture for the header's avatar, resolved exactly as the profile page does: the profile's
 * `avatarUrl`, fetched with the session's token into a data URL, and the local portrait when
 * there is none or it has not loaded. `pending` is true until the profile has answered, so the
 * header can wait instead of flashing a stand-in. If the profile cannot be read at all, the
 * dashboard's own `avatarUrl` is the next best source.
 */
export function useHeaderAvatar(dashboardAvatarUrl: string | null) {
  const profile = useQuery({ ...profileQueryOptions(), staleTime: PROFILE_FRESH_FOR_MS });
  const avatarUrl = profile.data
    ? profile.data.avatarUrl
    : profile.isError
      ? dashboardAvatarUrl
      : null;
  const photo = useAvatarSrc(avatarUrl);
  return { pending: profile.isPending, src: photo ?? AVATAR_PLACEHOLDER };
}
