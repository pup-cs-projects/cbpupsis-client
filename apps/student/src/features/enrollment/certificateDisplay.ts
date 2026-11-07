import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import { unmetItems } from "@cbpupsis/shared/enrollment";

/** What each COR_ENROLLMENT_NOT_FINAL `details.unmet` item means for the student. */
const UNMET_LABEL: Record<string, string> = {
  HOLD: "You have a hold on your account. Clear it with the office that placed it.",
  PREREQUISITE_VIOLATION: "A course you enrolled in needs a prerequisite you have not passed.",
  NO_ASSESSMENT: "Your fees have not been assessed yet. The Accounting Office does this.",
};

export function unmetLabel(item: string): string {
  return UNMET_LABEL[item] ?? `Not yet met: ${item}.`;
}

/** The certificate refusals of issue #43 in words (AC-ENRL-003.5, .6). */
export function certificateErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return errorMessage(error);
  if (error.code === "SERVICE_UNAVAILABLE" || error.status === 503) {
    return "The certificate could not be made. Try again in 30 seconds.";
  }
  if (error.code === "COR_NOT_ENROLLED") return "You are not enrolled this term.";
  if (error.code === "COR_ENROLLMENT_NOT_FINAL") {
    const unmet = unmetItems(error.details);
    return unmet.length > 0
      ? `Your enrollment is not final yet. ${unmet.map(unmetLabel).join(" ")}`
      : "Your enrollment is not final yet.";
  }
  return errorMessage(error);
}
