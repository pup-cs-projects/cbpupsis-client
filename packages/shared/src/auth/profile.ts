import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";
import type { components } from "../api/schema.gen";

export type UserProfile = Pick<
  components["schemas"]["UserRead"],
  "email" | "full_name" | "display_name"
>;

/** The authenticated user's own profile, available to every portal. */
export function createProfileApi(client: ApiClient) {
  return {
    async me(accessToken: string): Promise<UserProfile> {
      const body = parse.record(await client.request("/users/me", { method: "GET", accessToken }));
      return {
        email: parse.string(body.email),
        full_name: parse.optionalString(body.full_name),
        display_name: parse.optionalString(body.display_name),
      };
    },
  };
}
