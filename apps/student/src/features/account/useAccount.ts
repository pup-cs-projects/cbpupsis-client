import { useQuery } from "@tanstack/react-query";

import type { StudentPayment } from "@cbpupsis/shared/account";

import { session, studentAccountApi as api } from "../../lib/auth";
import { billingSample, sampleAccount, samplePayments } from "./sampleData";

/**
 * The billing calls, through the portal's session. With VITE_BILLING_SAMPLE set in a dev
 * build they answer with local sample data instead (see sampleData.ts).
 */
export const accountApi = {
  async account() {
    const sample = billingSample();
    if (sample) return sampleAccount(sample);
    return session.authorized((token) => api.account(token));
  },

  async payments() {
    const sample = billingSample();
    if (sample) return samplePayments(sample);
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
