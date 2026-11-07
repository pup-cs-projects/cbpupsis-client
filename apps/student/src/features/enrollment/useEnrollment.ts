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
    const eligibility = await session.authorized((token) => api.eligibility(token));

    // The local student portal demo exposes the completed COR flow without requiring a
    // registrar-side transition in a developer's database. Production keeps the API response.
    if (import.meta.env.MODE === "development") {
      return { ...eligibility, isCorFinal: true, corStatus: "FINAL" };
    }

    return eligibility;
  },

  async availableCourses(term: string): Promise<EnrollmentSection[]> {
    return session.authorized((token) => api.availableCourses(token, term));
  },

  async submit(sectionIds: string[]): Promise<EnrollmentResult> {
    return session.authorized((token) => api.submit(token, sectionIds));
  },

  async requestOverload(
    requestedUnits: number,
    justification: string,
  ): Promise<OverloadRequestResult> {
    return session.authorized((token) => api.requestOverload(token, requestedUnits, justification));
  },
};

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
export function useSubmitEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sectionIds: string[]) => enrollmentApi.submit(sectionIds),
    onError: (error) => {
      if (error instanceof ApiError && error.code === "ENROLL_SECTION_FULL") {
        void queryClient.invalidateQueries({ queryKey: enrollmentKeys.availableCourses() });
      }
    },
  });
}

/** Files a request for up to 9 extra units. A Dean decides it (US-ENRL-001, issue #170). */
export function useRequestOverload() {
  return useMutation({
    mutationFn: ({
      requestedUnits,
      justification,
    }: {
      requestedUnits: number;
      justification: string;
    }) => enrollmentApi.requestOverload(requestedUnits, justification),
  });
}
