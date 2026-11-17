import type { StudentAccount, StudentPayment } from "@cbpupsis/shared/account";

// Local sample data for the billing page, so its look can be reviewed before the API serves
// /student/account and /student/payments. Off unless a developer opts in: in
// apps/student/.env.local set  VITE_BILLING_SAMPLE=overdue  (or owing, forfeited, paid),
// then restart `npm run dev:student`. It never runs in a production build.

export type BillingSample = "overdue" | "owing" | "forfeited" | "paid";

const SCENARIOS: readonly BillingSample[] = ["overdue", "owing", "forfeited", "paid"];

/** The scenario the developer asked for, or null for the real API. */
export function billingSample(): BillingSample | null {
  // Tests always meet the mocked API, even when a developer's .env.local turns samples on.
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") return null;
  const value = import.meta.env.VITE_BILLING_SAMPLE as string | undefined;
  return SCENARIOS.find((scenario) => scenario === value) ?? null;
}

const LINES: StudentAccount["lines"] = [
  { code: "TUITION", description: "Tuition (21 units)", amount: "0.00", coveredBySubsidy: true },
  {
    code: "REGISTRATION",
    description: "Registration fee",
    amount: "145.00",
    coveredBySubsidy: true,
  },
  { code: "LABORATORY", description: "Laboratory fee", amount: "900.00", coveredBySubsidy: false },
  {
    code: "ID",
    description: "Student ID and library fee",
    amount: "1145.00",
    coveredBySubsidy: false,
  },
];

export function sampleAccount(scenario: BillingSample): StudentAccount {
  const base: StudentAccount = {
    amountAssessed: "2190.00",
    subsidyApplied: "145.00",
    netPayable: "2045.00",
    paymentStatus: "UNPAID",
    fheForfeited: false,
    fheForfeitureReason: null,
    overdueAmount: null,
    penaltyAmount: null,
    lines: LINES,
  };
  switch (scenario) {
    case "overdue":
      return {
        ...base,
        paymentStatus: "OVERDUE",
        overdueAmount: "2045.00",
        penaltyAmount: "204.50",
      };
    case "forfeited":
      return {
        ...base,
        subsidyApplied: null,
        netPayable: "2190.00",
        fheForfeited: true,
        fheForfeitureReason: "Dropped below the 12-unit minimum load during add/drop.",
        lines: LINES.map((line) => ({ ...line, coveredBySubsidy: false })),
      };
    case "paid":
      return { ...base, netPayable: "0.00", paymentStatus: "PAID" };
    case "owing":
      return base;
  }
}

export function samplePayments(scenario: BillingSample): StudentPayment[] {
  const payments: StudentPayment[] = [
    {
      id: "pay-3",
      paidAt: "2026-06-10T02:00:00Z",
      amount: "1000.00",
      reference: "PUP-2026-004521",
      status: "SETTLED",
      receiptUrl: "https://example.invalid/receipts/PUP-2026-004521",
    },
    {
      id: "pay-2",
      paidAt: "2026-01-12T03:30:00Z",
      amount: "2500.50",
      reference: "PUP-2026-000873",
      status: "SETTLED",
      receiptUrl: "https://example.invalid/receipts/PUP-2026-000873",
    },
    {
      id: "pay-1",
      paidAt: "2025-08-04T01:15:00Z",
      amount: "750.00",
      reference: "PUP-2025-009310",
      status: "PENDING",
      receiptUrl: null,
    },
  ];
  // The "paid" student has settled the balance with the newest payment.
  return scenario === "paid" ? payments : payments.slice(1);
}
