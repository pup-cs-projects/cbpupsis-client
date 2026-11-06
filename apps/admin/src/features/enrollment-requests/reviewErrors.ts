import { ApiError } from "@cbpupsis/shared/api";

export function reviewFailure(error: unknown): {
  message: string;
  field?: "remarks" | "reference";
  requestId?: string;
} {
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  if (error instanceof ApiError) {
    switch (error.code) {
      case "DECISION_REMARKS_REQUIRED":
        return { message: "Give a reason for the rejection.", field: "remarks", requestId };
      case "REQUEST_ALREADY_DECIDED":
        return {
          message:
            "This request has already been decided. Review its latest status before continuing.",
          requestId,
        };
      case "ENROLL_WAIVER_STEP_MISMATCH":
        return {
          message: "This waiver is not at your step. The request list is being refreshed.",
          requestId,
        };
      case "RESOURCE_NOT_FOUND":
        return { message: "This request is no longer available.", requestId };
      case "VALIDATION_ERROR":
        return {
          message: "Check the decision, remarks, and approval reference, then try again.",
          requestId,
        };
    }
    if (error.status === 403)
      return {
        message:
          "You no longer have permission to decide this request. Refresh the page to check your access.",
        requestId,
      };
  }
  return {
    message: "The decision could not be saved. Your entries have been kept. Please try again.",
    requestId,
  };
}
