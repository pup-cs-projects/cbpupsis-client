import { ApiError } from "@cbpupsis/shared/api";
import { unmetItems } from "@cbpupsis/shared/enrollment";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { certificateApi as api, session } from "../../lib/auth";

// Each call goes through certificateApi's property at call time, so a test can stand in for it.

export const certificateApi = {
  async read(termId: string) {
    return session.authorized((token) => api.read(token, termId));
  },

  async pdf(termId: string): Promise<Blob> {
    return session.authorized((token) => api.pdf(token, termId));
  },

  async issue(termId: string) {
    return session.authorized((token) => api.issue(token, termId));
  },
};

/**
 * True when the certificate is simply not issued yet: the enrollment exists and nothing is
 * unmet (GET answers COR_ENROLLMENT_NOT_FINAL with an empty `details.unmet`), so issuing it is
 * the next step rather than a refusal to show.
 */
export function isReadyToIssue(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === "COR_ENROLLMENT_NOT_FINAL" &&
    unmetItems(error.details).length === 0
  );
}

/** Saves a downloaded file under `filename` without leaving the page. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Let the click start the download before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * The official PDF from the API. A certificate not issued yet is issued once (a retry returns
 * the same certificate, so this is safe to repeat), then read again.
 */
export async function downloadCertificate(termId: string): Promise<void> {
  let blob: Blob;
  try {
    blob = await certificateApi.pdf(termId);
  } catch (error) {
    if (!isReadyToIssue(error)) throw error;
    await certificateApi.issue(termId);
    blob = await certificateApi.pdf(termId);
  }
  // The API names its file "certificate.pdf" with no identifiers in it; keep that.
  saveBlob(blob, "certificate.pdf");
}

export const certificateKeys = {
  all: ["certificate"] as const,
  byTerm: (termId: string) => [...certificateKeys.all, termId] as const,
};

/** The issued certificate for `termId`, as data for the preview (AC-ENRL-003.1, .2). */
export function useCertificate(termId: string | undefined) {
  return useQuery({
    queryKey: certificateKeys.byTerm(termId ?? ""),
    queryFn: () => certificateApi.read(termId as string),
    enabled: Boolean(termId),
    // A refusal is the answer, not a blip: retrying it only delays the message.
    retry: false,
  });
}

/** Issues the certificate once, then reads it again so the preview shows it (AC-ENRL-003.9). */
export function useIssueCertificate(termId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => certificateApi.issue(termId as string),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: certificateKeys.byTerm(termId ?? "") }),
  });
}

/** Saves the official PDF, with its busy state for the button (AC-ENRL-003.1). */
export function useDownloadCertificate(termId: string | undefined) {
  return useMutation({ mutationFn: () => downloadCertificate(termId as string) });
}
