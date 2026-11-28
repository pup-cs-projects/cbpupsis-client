import type { ApiClient } from "../api/client";
import * as p from "../api/parse";
import { parsePage } from "../sections/faculty";

/** One item in the header bell, for any role: /notifications is mounted for every portal. */
export interface PortalNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export function parsePortalNotification(value: unknown): PortalNotification {
  const row = p.record(value);
  const createdAt = p.string(row.created_at);
  return {
    id: p.string(row.id),
    title: p.string(row.title),
    body: typeof row.body === "string" ? row.body : p.invalid(),
    createdAt: Number.isFinite(Date.parse(createdAt)) ? createdAt : p.invalid(),
    read: row.read_at !== null && row.read_at !== undefined,
  };
}

export function createNotificationsApi(client: ApiClient) {
  return {
    async list(token: string, signal?: AbortSignal, limit = 10): Promise<PortalNotification[]> {
      const body = await client.request(`/notifications?limit=${limit}&offset=0`, {
        method: "GET",
        accessToken: token,
        signal,
      });
      return parsePage(body, parsePortalNotification).items;
    },
    async markAllRead(token: string): Promise<void> {
      await client.request("/notifications/read-all", { method: "POST", accessToken: token });
    },
  };
}

export type NotificationsApi = ReturnType<typeof createNotificationsApi>;
