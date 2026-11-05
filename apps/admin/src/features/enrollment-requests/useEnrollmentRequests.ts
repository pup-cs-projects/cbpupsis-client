import { ApiError } from "@cbpupsis/shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type {
  EnrollmentRequest,
  EnrollmentReviewDataSource,
  RequestKind,
  ReviewSubmission,
} from "./types";

export const enrollmentReviewKeys = {
  all: ["enrollment-requests"] as const,
  user: (userId: string) => [...enrollmentReviewKeys.all, userId] as const,
  list: (userId: string, kind: RequestKind) =>
    [...enrollmentReviewKeys.user(userId), kind] as const,
};

export function useEnrollmentRequests(
  kind: RequestKind,
  userId: string | undefined,
  enabled: boolean,
  source: EnrollmentReviewDataSource | undefined,
) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const key = enrollmentReviewKeys.list(userId ?? "signed-out", kind);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => {
      if (!source) throw new Error("Enrollment review is not configured");
      return source.list(kind, signal);
    },
    enabled: Boolean(source && userId && enabled),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: async (submission: ReviewSubmission) => {
      if (!source || !enabled || !userId) throw new Error("Enrollment review is not available");
      const updated = await source.decide(kind, submission);
      if (!updated || updated.id !== submission.requestId || updated.kind !== kind)
        throw new ApiError(0, "INVALID_RESPONSE");
      return updated;
    },
    retry: false,
    onSuccess: (updated) => {
      // Only use the server-confirmed state. Never advance a workflow locally.
      queryClient.setQueryData<EnrollmentRequest[]>(key, (items) =>
        items?.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(
        source?.isMock
          ? `${updated.id}: sample decision saved locally. It resets when the page is refreshed.`
          : `${updated.id}: decision saved.`,
      );
      if (userId)
        void queryClient.invalidateQueries({ queryKey: enrollmentReviewKeys.user(userId) });
    },
    onError: (error, submission) => {
      if (!(error instanceof ApiError)) return;
      if (error.code === "RESOURCE_NOT_FOUND") {
        queryClient.setQueryData<EnrollmentRequest[]>(key, (items) =>
          items?.filter((item) => item.id !== submission.requestId),
        );
        setNotice("This request is no longer available.");
      } else if (
        error.code === "REQUEST_ALREADY_DECIDED" ||
        error.code === "ENROLL_WAIVER_STEP_MISMATCH"
      ) {
        setNotice(
          error.code === "REQUEST_ALREADY_DECIDED"
            ? "Already decided. The request list is being refreshed."
            : "This waiver is not at your step. The request list is being refreshed.",
        );
      } else return;
      if (userId)
        void queryClient.invalidateQueries({ queryKey: enrollmentReviewKeys.user(userId) });
    },
  });

  return {
    ...query,
    connected: Boolean(source),
    loading: Boolean(source && enabled && userId && query.isPending),
    submitting: mutation.isPending,
    notice,
    dismissNotice: () => setNotice(""),
    decide: async (submission: ReviewSubmission) => {
      await mutation.mutateAsync(submission);
    },
  };
}
