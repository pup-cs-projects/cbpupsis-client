import { createAdminReportsApi, type ReportFilters } from "@cbpupsis/shared/reports/admin";
import { createAdminCatalogApi } from "@cbpupsis/shared/catalog/admin";
import type { CourseInput, SectionInput, CurriculumInput } from "@cbpupsis/shared/catalog/admin";
export type {
  Course,
  CourseInput,
  SectionInput,
  SectionRecord,
  CurriculumInput,
  CurriculumRecord,
} from "@cbpupsis/shared/catalog/admin";
import { ApiError, type ApiClient, type RequestOptions } from "@cbpupsis/shared/api";
import type { Session } from "@cbpupsis/shared/auth";

import { apiClient, apiConfig, session } from "./auth";

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}
export interface Preference {
  type: string;
  channel: "email" | "in_app";
  enabled: boolean;
  editable: boolean;
}
export interface AuditEntry {
  id: string;
  action: string;
  actor: string | null;
  targetType: string | null;
  target: string | null;
  occurredAt: string;
}
export interface SignInAttempt {
  id: string;
  identifier: string;
  success: boolean;
  mfa: boolean;
  occurredAt: string;
}
export interface UserAccount {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  verifiedAt: string | null;
}
export type { ReportFilters, EnrollmentReport } from "@cbpupsis/shared/reports/admin";

function invalid(): never {
  throw new ApiError(0, "INVALID_RESPONSE");
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid();
}
function text(value: unknown): string {
  return typeof value === "string" ? value : invalid();
}
function id(value: unknown): string {
  const result = text(value);
  return result.trim() ? result : invalid();
}
function optional(value: unknown): string | null {
  return value == null ? null : text(value);
}
function flag(value: unknown): boolean {
  return typeof value === "boolean" ? value : invalid();
}
function count(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : invalid();
}
function items(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalid();
}
function date(value: unknown): string {
  const result = id(value);
  return Number.isFinite(Date.parse(result)) ? result : invalid();
}
function optionalDate(value: unknown): string | null {
  return value == null ? null : date(value);
}
function page<T>(body: unknown, parse: (row: unknown) => T): Page<T> {
  const raw = record(body);
  const result = {
    items: items(raw.items).map(parse),
    total: count(raw.total),
    limit: count(raw.limit),
    offset: count(raw.offset),
  };
  if (
    !result.limit ||
    result.items.length > result.limit ||
    (result.items.length && result.total < result.offset + result.items.length)
  )
    invalid();
  return result;
}
function notification(body: unknown): NotificationItem {
  const raw = record(body);
  return {
    id: id(raw.id),
    type: id(raw.notification_type),
    title: text(raw.title),
    body: text(raw.body),
    readAt: optionalDate(raw.read_at),
    createdAt: date(raw.created_at),
  };
}
function audit(body: unknown): AuditEntry {
  const raw = record(body);
  // Payload/prior/new state may contain sensitive details; they never enter the UI cache.
  return {
    id: id(raw.id),
    action: id(raw.action),
    actor: optional(raw.actor_id),
    targetType: optional(raw.target_type),
    target: optional(raw.target_id),
    occurredAt: date(raw.occurred_at),
  };
}
function user(body: unknown): UserAccount {
  const raw = record(body);
  return {
    id: id(raw.id),
    email: text(raw.email),
    name: optional(raw.full_name)?.trim() || optional(raw.display_name)?.trim() || null,
    active: flag(raw.is_active),
    verifiedAt: optionalDate(raw.email_verified_at),
  };
}
function query(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== "") params.set(key, String(value));
  return params.size ? `?${params}` : "";
}
export function createAdminOperationsApi(
  client: ApiClient,
  auth: Pick<Session, "authorized">,
  usersPath: "/admin/users" = "/admin/users",
) {
  const catalog = createAdminCatalogApi(client);
  const reports = createAdminReportsApi(client);
  const request = (path: string, options: RequestOptions = {}) =>
    auth.authorized((token) =>
      client.request(path, { method: "GET", ...options, accessToken: token }),
    );
  return {
    courses: (search = "", offset = 0, signal?: AbortSignal, limit = 20) =>
      auth.authorized((token) => catalog.courses(token, search, offset, signal, limit)),
    saveCourse: (input: CourseInput, id?: string) =>
      auth.authorized((token) => catalog.saveCourse(token, input, id)),
    saveSection: (input: SectionInput, id?: string) =>
      auth.authorized((token) => catalog.saveSection(token, input, id)),
    publishCurriculum: (program: string, input: CurriculumInput) =>
      auth.authorized((token) => catalog.publishCurriculum(token, program, input)),
    deleteCurriculum: (program: string, id: string) =>
      auth.authorized((token) => catalog.deleteCurriculum(token, program, id)),
    report: (filters: ReportFilters, signal?: AbortSignal) =>
      auth.authorized((token) => reports.enrollment(token, filters, signal)),
    exportReport: (filters: ReportFilters, format: "csv" | "pdf") =>
      auth.authorized((token) => reports.exportEnrollment(token, filters, format)),
    async notifications(offset = 0, signal?: AbortSignal) {
      return page(
        await request("/notifications" + query({ limit: 20, offset }), { signal }),
        notification,
      );
    },
    async unread(signal?: AbortSignal) {
      return count(record(await request("/notifications/unread-count", { signal })).unread);
    },
    async markRead(notificationId: string) {
      return notification(
        await request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
          method: "POST",
        }),
      );
    },
    async markAllRead() {
      await request("/notifications/read-all", { method: "POST" });
    },
    async preferences(signal?: AbortSignal): Promise<Preference[]> {
      return items(await request("/notifications/preferences", { signal })).map((value) => {
        const raw = record(value);
        const channel = text(raw.channel);
        if (channel !== "email" && channel !== "in_app") invalid();
        return {
          type: id(raw.notification_type),
          channel,
          enabled: flag(raw.enabled),
          editable: flag(raw.editable),
        };
      });
    },
    async setPreference(input: Preference) {
      await request("/notifications/preferences", {
        method: "PUT",
        body: { notification_type: input.type, channel: input.channel, enabled: input.enabled },
      });
    },
    async audit(action = "", offset = 0, signal?: AbortSignal, limit = 20) {
      return page(await request("/audit" + query({ action, limit, offset }), { signal }), audit);
    },
    async signIns(offset = 0, signal?: AbortSignal) {
      return page(
        await request("/audit/sign-in-attempts" + query({ limit: 20, offset }), { signal }),
        (value) => {
          const raw = record(value);
          return {
            id: id(raw.id),
            identifier: text(raw.attempted_id),
            success: flag(raw.success),
            mfa: flag(raw.mfa_used),
            occurredAt: date(raw.created_at),
          } satisfies SignInAttempt;
        },
      );
    },
    async users(active: string, offset = 0, signal?: AbortSignal) {
      return page(
        await request(
          usersPath +
            query({
              is_active: active === "all" ? undefined : active === "active",
              limit: 20,
              offset,
            }),
          { signal },
        ),
        user,
      );
    },
    async setUserActive(userId: string, active: boolean) {
      return user(
        await request(
          `${usersPath}/${encodeURIComponent(userId)}/${active ? "reactivate" : "deactivate"}`,
          { method: "POST" },
        ),
      );
    },
  };
}
export const adminOperationsApi = createAdminOperationsApi(apiClient, session, apiConfig.usersPath);

export function adminApiMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Your account does not have permission to use this feature.";
    if (error.status === 401) return "Your session has ended. Sign in again to continue.";
    if (error.status === 404)
      return "This record or service is not available. Refresh and check your selection.";
    if (error.status === 409)
      return "This record conflicts with an existing or recently changed record. Refresh before continuing.";
    if (error.status === 422)
      return "Check the entered values and record references, then try again.";
    if (error.code === "INVALID_RESPONSE")
      return "The server returned an unexpected response. Please contact support.";
  }
  return "The request could not be confirmed. Refresh before trying again.";
}
