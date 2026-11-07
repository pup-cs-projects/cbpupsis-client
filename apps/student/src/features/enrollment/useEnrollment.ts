import { ApiError } from "@cbpupsis/shared/api";
import type {
  EnrollmentEligibility,
  EnrollmentResult,
  EnrollmentSection,
  OverloadRequestResult,
} from "@cbpupsis/shared/enrollment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { enrollmentApi as api, session } from "../../lib/auth";

export const enrollmentKeys = {
  all: ["enrollment"] as const,
  eligibility: () => [...enrollmentKeys.all, "eligibility"] as const,
  availableCourses: () => [...enrollmentKeys.all, "available-courses"] as const,
};

// Each call goes through enrollmentApi's property at call time, so a test can stand in for it.

export const enrollmentApi = {
  async eligibility(): Promise<EnrollmentEligibility> {
    return session.authorized((token) => api.eligibility(token));
  },

  async availableCourses(academicTermId: string): Promise<EnrollmentSection[]> {
    return session.authorized((token) => api.availableCourses(token, academicTermId));
  },

  async submit(academicTermId: string, sectionIds: string[]): Promise<EnrollmentResult> {
    return session.authorized((token) => api.submit(token, academicTermId, sectionIds));
  },

  async requestOverload(
    academicTermId: string,
    requestedUnits: number,
    justification: string,
  ): Promise<OverloadRequestResult> {
    return session.authorized((token) =>
      api.requestOverload(token, academicTermId, requestedUnits, justification),
    );
  },
};

/** The current term from eligibility: its UUID for every call, its name for display. */
export interface CurrentTerm {
  id: string;
  /** "2026-2027-First Semester", or null when the API sends no name. */
  name: string | null;
}

export function currentTermOf(eligibility: EnrollmentEligibility | undefined): CurrentTerm | null {
  return eligibility?.academicTermId
    ? { id: eligibility.academicTermId, name: eligibility.term }
    : null;
}

/** Whether the student may enroll, and their unit ceiling (AC-ENRL-001.1, .6, .7). */
export function useEligibility() {
  return useQuery({
    queryKey: enrollmentKeys.eligibility(),
    queryFn: enrollmentApi.eligibility,
  });
}

/**
 * The sections open to the student. Held back until eligibility has loaded a term and says the
 * period is open and the student may enroll: there is nothing to pick otherwise (AC-ENRL-001.10,
 * .13, .14).
 */
export function useAvailableCourses(term: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...enrollmentKeys.availableCourses(), term],
    queryFn: () => enrollmentApi.availableCourses(term as string),
    enabled: enabled && Boolean(term),
  });
}

/** Submits the picked sections once. A section that just filled reloads the course list. */
export function useSubmitEnrollment(term: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sectionIds: string[]) => enrollmentApi.submit(term as string, sectionIds),
    onError: (error) => {
      if (error instanceof ApiError && error.code === "ENROLL_SECTION_FULL") {
        void queryClient.invalidateQueries({ queryKey: enrollmentKeys.availableCourses() });
      }
    },
  });
}

/** Files a request for up to 9 extra units. A Dean decides it (US-ENRL-001, issue #170). */
export function useRequestOverload(term: string | undefined) {
  return useMutation({
    mutationFn: ({
      requestedUnits,
      justification,
    }: {
      requestedUnits: number;
      justification: string;
    }) => enrollmentApi.requestOverload(term as string, requestedUnits, justification),
  });
}
