import type { EnrollmentReviewDataSource } from "./types";

/**
 * Backend integration point. Supply an authenticated implementation here when ready.
 * Map the backend response into the view model in types.ts; keep transport-specific
 * field names out of components. Throw ApiError for HTTP failures.
 *
 * list() must return the complete category list already scoped by the backend.
 * decide() must resolve only after a confirmed server decision, returning its updated
 * record (including the server's state, version and review history).
 *
 * Production has no fallback data. In development, the page supplies an in-memory
 * mock adapter only when this backend integration point is unconfigured.
 */
export const enrollmentReviewDataSource: EnrollmentReviewDataSource | undefined = undefined;
