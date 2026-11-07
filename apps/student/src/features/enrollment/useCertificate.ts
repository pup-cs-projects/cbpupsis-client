import { ApiError } from "@cbpupsis/shared/api";
import { unmetItems } from "@cbpupsis/shared/enrollment";

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
