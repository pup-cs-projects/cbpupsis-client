import type { ApiClient } from "../api/client";
import * as p from "../api/parse";
import type { ProfileField } from "./student";

export interface FacultyProfile {
  fields: Record<string, ProfileField>;
  petitionRoute: string;
}
export interface NotificationPreference {
  type: string;
  channel: "email" | "in_app";
  enabled: boolean;
  editable: boolean;
}
function profile(value: unknown): FacultyProfile {
  const row = p.record(value);
  return {
    petitionRoute: p.string(row.petitionRoute),
    fields: Object.fromEntries(
      Object.entries(p.record(row.fields)).map(([name, raw]) => {
        const field = p.record(raw);
        if (field.value !== null && typeof field.value !== "string") p.invalid();
        return [name, { value: field.value as string | null, editable: p.boolean(field.editable) }];
      }),
    ),
  };
}
export function createFacultyProfileApi(client: ApiClient) {
  return {
    async get(token: string, signal?: AbortSignal) {
      return profile(
        await client.request("/faculty/profile", { method: "GET", accessToken: token, signal }),
      );
    },
    async update(token: string, fields: Record<string, string>) {
      return profile(
        await client.request("/faculty/profile", {
          method: "PATCH",
          body: fields,
          accessToken: token,
        }),
      );
    },
    async preferences(token: string, signal?: AbortSignal): Promise<NotificationPreference[]> {
      return p
        .array(
          await client.request("/notifications/preferences", {
            method: "GET",
            accessToken: token,
            signal,
          }),
        )
        .map((value) => {
          const row = p.record(value);
          return {
            type: p.string(row.notification_type),
            channel: p.oneOf(row.channel, ["email", "in_app"]),
            enabled: p.boolean(row.enabled),
            editable: p.boolean(row.editable),
          };
        });
    },
    async setPreference(
      token: string,
      preference: Pick<NotificationPreference, "type" | "channel" | "enabled">,
    ): Promise<void> {
      await client.request("/notifications/preferences", {
        method: "PUT",
        accessToken: token,
        body: {
          notification_type: preference.type,
          channel: preference.channel,
          enabled: preference.enabled,
        },
      });
    },
  };
}
export type FacultyProfileApi = ReturnType<typeof createFacultyProfileApi>;
