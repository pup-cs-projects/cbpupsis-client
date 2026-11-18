import { ApiError } from "@cbpupsis/shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { reviewFailure } from "./reviewErrors";
import type {
  EnrollmentRequestList,
  EnrollmentReviewDataSource,
  RequestKind,
  ReviewSubmission,
} from "./types";

export const enrollmentReviewKeys = {
  all: ["enrollment-requests"] as const,
  user: (userId: string) => ["enrollment-requests", userId] as const,
  list: (userId: string, kind: RequestKind) => ["enrollment-requests", userId, kind] as const,
};

export function useEnrollmentRequests(
  kind: RequestKind,
  userId: string | undefined,
  enabled: boolean,
  source: EnrollmentReviewDataSource | undefined,
) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [rowNotices, setRowNotices] = useState<Record<string, string>>({});
  const rowKey = (requestId: string) => `${userId}:${kind}:${requestId}`;
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
      if (!source || !enabled || !userId || submission.kind !== kind)
        throw new Error("Enrollment review is not available");
      const updated = await source.decide(submission);
      if (!updated || updated.id !== submission.requestId || updated.kind !== submission.kind)
        throw new ApiError(0, "INVALID_RESPONSE");
      return updated;
    },
    retry: false,
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-reports", userId] });
      const updatedKey = enrollmentReviewKeys.list(userId!, updated.kind);
      queryClient.setQueryData<EnrollmentRequestList>(updatedKey, (list) =>
        list
          ? {
              ...list,
              items: list.items.map((item) => (item.id === updated.id ? updated : item)),
            }
          : list,
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
        queryClient.setQueryData<EnrollmentRequestList>(
          enrollmentReviewKeys.list(userId!, submission.kind),
          (list) =>
            list
              ? {
                  items: list.items.filter((item) => item.id !== submission.requestId),
                  total: list.items.some((item) => item.id === submission.requestId)
                    ? Math.max(0, list.total - 1)
                    : list.total,
                }
              : list,
        );
        setNotice("This request is no longer available.");
      } else if (
        error.code === "REQUEST_ALREADY_DECIDED" ||
        error.code === "ENROLL_WAIVER_STEP_MISMATCH"
      ) {
        const message = reviewFailure(error).message;
        setRowNotices((items) => ({
          ...items,
          [`${userId}:${submission.kind}:${submission.requestId}`]: message,
        }));
        setNotice(message);
      } else if (error.code === "REQUEST_CONCURRENCY_CONFLICT") {
        // No row notice: the reload brings the new version, and the row can be decided again.
        setNotice(reviewFailure(error).message);
      } else return;
      if (userId)
        void queryClient.invalidateQueries({ queryKey: enrollmentReviewKeys.user(userId) });
    },
  });
  return {
    ...query,
    isMock: Boolean(source?.isMock),
    loading: Boolean(source && enabled && userId && query.isPending),
    submitting: mutation.isPending,
    notice,
    dismissNotice: () => setNotice(""),
    rowNotices: Object.fromEntries(
      (query.data?.items ?? []).flatMap((item) =>
        rowNotices[rowKey(item.id)] ? [[item.id, rowNotices[rowKey(item.id)]]] : [],
      ),
    ),
    decide: async (submission: ReviewSubmission) => {
      await mutation.mutateAsync(submission);
    },
  };
}
