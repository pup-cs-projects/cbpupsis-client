import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import type {
  AddDropAvailableCourse,
  AddDropRequestCreate,
  AddDropRequestRead,
  AddDropWindow,
} from "@cbpupsis/shared/enrollment";
import type { StudentSchedule } from "@cbpupsis/shared/schedule";

import { addDropApi as api, scheduleApi as scheduleClient, session } from "../../lib/auth";

/** The add and drop page's data calls, through the portal's session. */
export const addDropApi = {
  /** The enrolled courses and the term they belong to. */
  async enrolled(): Promise<StudentSchedule> {
    return session.authorized((token) => scheduleClient.current(token));
  },

  async window(): Promise<AddDropWindow> {
    return session.authorized((token) => api.window(token));
  },

  async available(term: string): Promise<AddDropAvailableCourse[]> {
    return session.authorized((token) => api.availableCourses(token, term));
  },

  async requests(): Promise<AddDropRequestRead[]> {
    return session.authorized((token) => api.list(token));
  },

  async request(requestId: string): Promise<AddDropRequestRead> {
    return session.authorized((token) => api.get(token, requestId));
  },

  async send(body: AddDropRequestCreate): Promise<AddDropRequestRead> {
    return session.authorized((token) => api.create(token, body));
  },
};

export const addDropKeys = {
  all: ["addDrop"] as const,
  enrolled: () => [...addDropKeys.all, "enrolled"] as const,
  window: () => [...addDropKeys.all, "window"] as const,
  available: (term: string) => [...addDropKeys.all, "available", term] as const,
  requests: () => [...addDropKeys.all, "requests"] as const,
  request: (requestId: string) => [...addDropKeys.all, "request", requestId] as const,
};

/** The stored academic year and semester joined by a hyphen, as available-courses takes it. */
export function termSelector(schedule: StudentSchedule): string | null {
  return schedule.term ? `${schedule.term.year}-${schedule.term.semester}` : null;
}

// Each call goes through addDropApi's property at call time, so a test can stand in for it.

export function useEnrolledCourses() {
  return useQuery({ queryKey: addDropKeys.enrolled(), queryFn: () => addDropApi.enrolled() });
}

export function useAddDropWindow() {
  return useQuery({ queryKey: addDropKeys.window(), queryFn: () => addDropApi.window() });
}

export function useAvailableCourses(term: string | null) {
  return useQuery({
    queryKey: addDropKeys.available(term ?? ""),
    queryFn: () => addDropApi.available(term ?? ""),
    enabled: term !== null,
  });
}

export function useAddDropRequests() {
  return useQuery({ queryKey: addDropKeys.requests(), queryFn: () => addDropApi.requests() });
}

export function useAddDropRequest(requestId: string | null) {
  return useQuery({
    queryKey: addDropKeys.request(requestId ?? ""),
    queryFn: () => addDropApi.request(requestId ?? ""),
    enabled: requestId !== null,
  });
}

export function useSendAddDrop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddDropRequestCreate) => addDropApi.send(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: addDropKeys.requests() }),
  });
}

/** The add and drop window from a 409 ENROLL_ADD_DROP_PERIOD_CLOSED (AC-ENRL-004.7). */
export interface ClosedPeriod {
  start: string;
  end: string;
}

/** The window, when the eligibility read says it is not open (AC-ENRL-004.7, on page load). */
export function closedWindow(window: AddDropWindow | undefined): ClosedPeriod | null {
  const period = window?.addDropPeriod;
  return period && !period.isOpen ? { start: period.start, end: period.end } : null;
}

export function closedPeriod(error: unknown): ClosedPeriod | null {
  if (!(error instanceof ApiError) || error.code !== "ENROLL_ADD_DROP_PERIOD_CLOSED") return null;
  const start = error.details?.periodStart;
  const end = error.details?.periodEnd;
  return typeof start === "string" && typeof end === "string" ? { start, end } : null;
}

/**
 * What a refused request says. A drop under the minimum load names the minimum
 * (AC-ENRL-004.8); every other refusal, including the enrollment rules on additions
 * (AC-ENRL-004.10), shows the API's own sentence, as the enrollment page does.
 */
export function refusalMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "ENROLL_BELOW_MINIMUM_LOAD") {
    const minimum = error.details?.minimumLoad;
    if (typeof minimum === "string" || typeof minimum === "number") {
      return `This drop leaves you under the ${minimum}-unit minimum.`;
    }
  }
  return errorMessage(error);
}

/** A student reading a request that is not theirs, or gone (AC-ENRL-004.9). */
export function isRequestUnavailable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
