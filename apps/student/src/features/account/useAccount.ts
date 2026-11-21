import { useQuery } from "@tanstack/react-query";

import type { StudentAccount, StudentPayment } from "@cbpupsis/shared/account";
import { ApiError } from "@cbpupsis/shared/api";

import { session, studentAccountApi as api } from "../../lib/auth";
// Demo data, off now that the API serves these calls. To bring it back, uncomment this import,
// the `billingSample()` lines below, the note in AccountPage.tsx, and the contents of
// sampleData.ts, then set VITE_BILLING_SAMPLE in .env.local.
// import { billingSample, sampleAccount, samplePayments } from "./sampleData";

/** The billing calls, through the portal's session. */
export const accountApi = {
  /**
   * The current term's statement, or null when the student has no billing account yet (the API
   * answers 404 RESOURCE_NOT_FOUND for a missing term or account): nothing to pay, not a failure.
   */
  async account(): Promise<StudentAccount | null> {
    // const sample = billingSample();
    // if (sample) return sampleAccount(sample);
    try {
      return await session.authorized((token) => api.account(token));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  async payments(): Promise<StudentPayment[]> {
    // const sample = billingSample();
    // if (sample) return samplePayments(sample);
    return session.authorized((token) => api.payments(token));
  },
};

export const accountKeys = {
  all: ["account"] as const,
  statement: () => [...accountKeys.all, "statement"] as const,
  payments: () => [...accountKeys.all, "payments"] as const,
};

/** Newest payment first (AC-FIN-001.8). Dates are compared, never amounts. */
function newestFirst(payments: StudentPayment[]): StudentPayment[] {
  return [...payments].sort((a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt));
}

// Each call goes through accountApi's property at call time, so a test can stand in for it.

/** GET /student/account: the net payable, the assessment lines, and the payment status. */
export function useStudentAccount() {
  return useQuery({ queryKey: accountKeys.statement(), queryFn: () => accountApi.account() });
}

/** GET /student/payments, newest first. */
export function useStudentPayments() {
  return useQuery({
    queryKey: accountKeys.payments(),
    queryFn: () => accountApi.payments(),
    select: newestFirst,
  });
}
