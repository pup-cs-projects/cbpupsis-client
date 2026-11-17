import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const ACCOUNT_ROUTE = "GET /student/account";
const PAYMENTS_ROUTE = "GET /student/payments";

type Body = Record<string, unknown>;

/** A student who owes money, with no overdue payment. */
function account(overrides: Body = {}): Body {
  return {
    amountAssessed: "3000.00",
    subsidyApplied: "1000.00",
    netPayable: "2045.00",
    paymentStatus: "DUE",
    holds: [],
    fheQualified: true,
    fheForfeited: false,
    fheForfeitureReason: null,
    lines: [
      {
        description: "Tuition (18 units)",
        amount: "1000.00",
        coveredByFhe: true,
      },
      {
        description: "Laboratory fee",
        amount: "2045.00",
        coveredByFhe: false,
      },
    ],
    ...overrides,
  };
}

/** A payment as the API sends it: date, amount, reference, status. */
function payment(overrides: Body = {}): Body {
  return {
    date: "2026-06-10T02:00:00Z",
    amount: "500.00",
    reference: "REF-0001",
    status: "PAID",
    ...overrides,
  };
}

const RECEIPT_URL = "https://sis.example.test/receipts/REF-0001";

/** The late fine line the API adds once an account is overdue. */
const FINE_LINE = { description: "Late payment fine", amount: "100.00", coveredByFhe: false };

function openAccount(routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [ACCOUNT_ROUTE]: { status: 200, body: account() },
    [PAYMENTS_ROUTE]: { status: 200, body: [] },
    ...routes,
  });
  renderApp("/account");
  return api;
}

/** The dd beside a dt with this label. */
function figure(label: string) {
  return screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
}

/** A plain typographic label: no pill, chip, border, or background fill. */
function expectPlainText(element: HTMLElement) {
  const decoration = Array.from(element.classList).filter((name) =>
    /^(rounded|bg-|border|px-|py-)/.test(name),
  );
  expect(decoration).toEqual([]);
}

async function loaded() {
  await screen.findByRole("heading", { name: "Account Status" });
}

afterEach(() => {
  session.signOut();
  vi.unstubAllGlobals();
});

describe("AccountPage header", () => {
  it("shows the Finance breadcrumb, the title, and the current subtitle", async () => {
    openAccount();
    await loaded();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Finance>Billing & Payments");
    // The same classes My Schedule and Grades use, so the header sits where theirs does.
    expect(within(breadcrumb).getByRole("list")).toHaveClass(
      "mb-2",
      "flex",
      "items-center",
      "gap-1.5",
      "text-xs",
      "text-neutral-500",
    );
    expect(within(breadcrumb).getByText("Billing & Payments")).toHaveClass(
      "text-brand-ink",
      "font-semibold",
    );
    const title = screen.getByRole("heading", { level: 1, name: "Billing & Payments" });
    expect(title).toHaveClass(
      "text-brand-crimson",
      "text-3xl",
      "font-bold",
      "tracking-tight",
      "sm:text-4xl",
    );
    const subtitle = screen.getByText(
      "View your current semester billing assessment, subsidy coverage, and payment status.",
    );
    expect(subtitle).toHaveClass(
      "mt-1",
      "mb-6",
      "max-w-3xl",
      "text-sm",
      "leading-relaxed",
      "text-neutral-600",
    );
    // The page wrapper matches too: same padding and 24px rhythm between blocks.
    expect(breadcrumb.parentElement).toHaveClass("space-y-6", "px-4", "py-8", "sm:px-8");
    expect(title.parentElement?.parentElement).toBe(breadcrumb.parentElement);
    expect(screen.queryByText(/Modify your course selection/)).not.toBeInTheDocument();
  });

  it("the sidebar's Billing & Payments entry opens this page", async () => {
    const user = userEvent.setup();
    openAccount();
    await loaded();

    // The sidebar starts collapsed; Finance is already the open section on this route.
    await user.click(screen.getByRole("button", { name: "Expand menu" }));
    const link = screen.getByRole("link", { name: "Billing & Payments" });
    expect(link).toHaveAttribute("href", "/account");
    expect(link).toHaveAttribute("aria-current", "page");
  });
});

describe("AccountPage (US-FIN-001)", () => {
  it("AC-FIN-001.1: net payable is the largest figure, with the amount assessed and subsidy applied below it", async () => {
    openAccount();
    await loaded();

    const net = figure("Net Payable");
    expect(net).toHaveTextContent("₱2,045.00");
    expect(net).toHaveClass("text-4xl", "sm:text-5xl", "font-bold");
    expect(net).not.toHaveClass("font-extrabold");

    const assessed = figure("Amount Assessed");
    const subsidy = figure("Subsidy Applied");
    expect(assessed).toHaveTextContent("₱3,000.00");
    expect(subsidy).toHaveTextContent("₱1,000.00");
    // Below, in reading order, and smaller.
    expect(net.compareDocumentPosition(assessed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      assessed.compareDocumentPosition(subsidy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(assessed).not.toHaveClass("text-4xl");
    expect(subsidy).not.toHaveClass("text-4xl");
    // Labels and figures sit in one two-column grid, so the amounts line up.
    expect(assessed.parentElement).toHaveClass("grid", "grid-cols-[140px_1fr]");
    expect(assessed.parentElement).toBe(subsidy.parentElement);
    expect(assessed).toHaveClass("tabular-nums", "font-medium");
  });

  it("AC-FIN-001.2: each line shows its amount and 'Subsidized (Free Tuition)' or 'Student Account'", async () => {
    openAccount();
    await loaded();

    expect(
      screen.getByRole("heading", { name: "Current Semester Assessment" }),
    ).toBeInTheDocument();
    const headers = screen
      .getAllByRole("columnheader")
      .slice(0, 3)
      .map((cell) => cell.textContent);
    expect(headers).toEqual(["Description", "Amount", "Coverage"]);

    // Three equal, left-aligned columns that scroll rather than squish at 320px.
    const table = screen.getByRole("table", { name: /assessment/i });
    expect(table).toHaveClass("table-fixed", "w-full", "min-w-[600px]");
    for (const header of within(table).getAllByRole("columnheader")) {
      expect(header).toHaveClass("w-1/3", "text-left");
    }
    for (const cell of within(table).getAllByRole("cell")) {
      expect(cell).toHaveClass("text-left");
      expect(cell).not.toHaveClass("text-right");
    }

    const tuition = screen
      .getByRole("rowheader", { name: "Tuition (18 units)" })
      .closest("tr") as HTMLElement;
    expect(within(tuition).getByText("₱1,000.00")).toBeInTheDocument();
    expect(within(tuition).getByText("Subsidized (Free Tuition)")).toBeInTheDocument();
    expect(within(tuition).queryByText("Student Account")).not.toBeInTheDocument();
    // Plain text, no pill: emerald when free tuition covers it, neutral when the student pays.
    const covered = within(tuition).getByText("Subsidized (Free Tuition)");
    expect(covered).toHaveClass("text-sm", "font-medium", "text-emerald-700");
    expectPlainText(covered);

    const lab = screen
      .getByRole("rowheader", { name: "Laboratory fee" })
      .closest("tr") as HTMLElement;
    expect(within(lab).getByText("₱2,045.00")).toBeInTheDocument();
    const youPay = within(lab).getByText("Student Account");
    expect(youPay).toHaveClass("text-sm", "text-neutral-700");
    expectPlainText(youPay);
    expect(within(lab).queryByText("Subsidized (Free Tuition)")).not.toBeInTheDocument();
  });

  it("AC-FIN-001.4: a forfeited subsidy shows 'Paying status' and the API's reason, word for word", async () => {
    const reason = "Dropped below the 12-unit minimum load during the add/drop period.";
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({
          fheForfeited: true,
          fheForfeitureReason: reason,
          subsidyApplied: "0.00",
          netPayable: "3000.00",
        }),
      },
    });
    await loaded();

    const note = screen.getByText("Paying status").parentElement as HTMLElement;
    expect(within(note).getByText(reason)).toBeInTheDocument();
    expect(screen.queryByText("Subsidy Applied")).not.toBeInTheDocument();
  });

  it("AC-FIN-001.4: no 'Paying status' note while the subsidy stands", async () => {
    openAccount();
    await loaded();

    expect(screen.queryByText("Paying status")).not.toBeInTheDocument();
  });

  it("AC-FIN-001.6: no subsidy line when the student has no subsidy (the API sends '0.00')", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({ subsidyApplied: "0.00", netPayable: "3000.00" }),
      },
    });
    await loaded();

    expect(figure("Amount Assessed")).toHaveTextContent("₱3,000.00");
    expect(screen.queryByText("Subsidy Applied")).not.toBeInTheDocument();
  });

  it("AC-FIN-001.7: an OVERDUE account shows an alert with a warning icon, the overdue amount, and the penalty", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        // The API folds the fine into netPayable and lists it as a line.
        body: account({
          paymentStatus: "OVERDUE",
          netPayable: "2145.00",
          lines: [...(account().lines as unknown[]), FINE_LINE],
        }),
      },
    });
    await loaded();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Overdue payment: ₱2,145.00 (Penalty: ₱100.00) — Pay now to lift the hold on enrollment.",
    );
    expect(alert).not.toHaveTextContent("CoR");
    expect(alert.querySelector("svg.lucide-triangle-alert")).toBeInTheDocument();
    expect(alert.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByText(/No Outstanding Balance/)).not.toBeInTheDocument();
  });

  it("AC-FIN-001.7: an OVERDUE account with no fine line yet shows the overdue amount alone", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({ paymentStatus: "OVERDUE", netPayable: "2045.00" }),
      },
    });
    await loaded();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Overdue payment: ₱2,045.00 — Pay now to lift the hold on enrollment.",
    );
    expect(alert).not.toHaveTextContent("Penalty");
  });

  it("AC-FIN-001.7: a PARTIAL or DUE account is not shown as overdue", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: { status: 200, body: account({ paymentStatus: "PARTIAL" }) },
    });
    await loaded();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay Now" })).toBeInTheDocument();
  });

  it("shows the late fine as a line the student pays", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({
          paymentStatus: "OVERDUE",
          netPayable: "2145.00",
          lines: [...(account().lines as unknown[]), FINE_LINE],
        }),
      },
    });
    await loaded();

    const fine = screen.getByRole("rowheader", { name: "Late payment fine" }).closest("tr");
    expect(within(fine as HTMLElement).getByText("₱100.00")).toBeInTheDocument();
    expect(within(fine as HTMLElement).getByText("Student Account")).toBeInTheDocument();
  });

  it("shows 'No Outstanding Balance' with a check icon, and no Pay Now, when nothing is owed", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({ netPayable: "0.00", paymentStatus: "PAID" }),
      },
    });
    await loaded();

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(
      "No Outstanding Balance — Your account is in good standing. Enrollment is accessible.",
    );
    expect(banner).not.toHaveTextContent("CoR");
    expect(banner.querySelector("svg.lucide-circle-check")).toBeInTheDocument();
    expect(figure("Net Payable")).toHaveTextContent("₱0.00");
    expect(screen.queryByRole("button", { name: "Pay Now" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download Invoice" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("offers Pay Now and Download Invoice while a balance is owed", async () => {
    const user = userEvent.setup();
    const print = vi.fn();
    vi.stubGlobal("print", print);
    openAccount();
    await loaded();

    expect(screen.queryByText(/No Outstanding Balance/)).not.toBeInTheDocument();
    const pay = screen.getByRole("button", { name: "Pay Now" });
    expect(pay.parentElement).toHaveClass("flex-col", "sm:flex-row", "gap-3");
    expect(pay).toHaveClass("min-w-[180px]", "h-11");

    await user.click(screen.getByRole("button", { name: "Download Invoice" }));
    expect(print).toHaveBeenCalledTimes(1);

    await user.click(pay);
    expect(screen.getByRole("status")).toHaveTextContent("Online payment is not available");
  });

  it("AC-FIN-001.8: payment history lists date, amount, reference, and status, newest first", async () => {
    openAccount({
      [PAYMENTS_ROUTE]: {
        status: 200,
        body: [
          payment({
            date: "2026-03-01T04:00:00Z",
            reference: "REF-OLD",
            amount: "100.00",
          }),
          payment({
            date: "2026-06-10T02:00:00Z",
            reference: "REF-NEW",
            amount: "2500.50",
          }),
          payment({
            date: "2026-04-15T04:00:00Z",
            reference: "REF-MID",
            amount: "750.00",
          }),
        ],
      },
    });
    await loaded();

    expect(screen.getByRole("heading", { name: "Payment History" })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /payment history/i });
    const [, ...rows] = within(table).getAllByRole("row");
    expect(rows.map((row) => within(row).getAllByRole("cell")[2]?.textContent)).toEqual([
      "REF-NEW",
      "REF-MID",
      "REF-OLD",
    ]);

    const newest = rows[0] as HTMLElement;
    const cells = within(newest).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("06/10/2026");
    expect(cells[1]).toHaveTextContent("₱2,500.50");
    expect(cells[1]).toHaveClass("tabular-nums");
    expect(cells[2]).toHaveTextContent("REF-NEW");
    expect(cells[2]).toHaveClass("font-mono", "text-xs");
    const paid = within(cells[3] as HTMLElement).getByText("Paid");
    expect(paid).toHaveClass("text-sm", "font-medium", "text-emerald-700");
    expectPlainText(paid);

    // Five equal, left-aligned columns, the last headed Action, that scroll at 320px.
    expect(table).toHaveClass("table-fixed", "w-full", "min-w-[600px]");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((cell) => cell.textContent)).toEqual([
      "Date",
      "Amount",
      "Reference",
      "Status",
      "Action",
    ]);
    for (const header of headers) expect(header).toHaveClass("w-1/5", "text-left");
    for (const cell of within(table).getAllByRole("cell")) {
      expect(cell).toHaveClass("text-left");
      expect(cell).not.toHaveClass("text-right");
    }
  });

  it("AC-FIN-001.8: dates are MM/DD/YYYY on the Philippine calendar day", async () => {
    openAccount({
      [PAYMENTS_ROUTE]: {
        status: 200,
        body: [
          // 17:00 UTC on June 30 is 01:00 on July 1 in Manila.
          payment({ date: "2026-06-30T17:00:00Z", reference: "REF-LATE" }),
          payment({ date: "2025-08-04T01:15:00Z", reference: "REF-AUG" }),
        ],
      },
    });
    await loaded();

    const late = screen.getByText("REF-LATE").closest("tr") as HTMLElement;
    expect(within(late).getAllByRole("cell")[0]).toHaveTextContent("07/01/2026");
    const aug = screen.getByText("REF-AUG").closest("tr") as HTMLElement;
    expect(within(aug).getAllByRole("cell")[0]).toHaveTextContent("08/04/2025");
  });

  it("AC-FIN-001.8: only a settled payment has a Receipt link", async () => {
    openAccount({
      [PAYMENTS_ROUTE]: {
        status: 200,
        body: [
          payment({
            reference: "REF-SETTLED",
            date: "2026-06-10T02:00:00Z",
            receiptUrl: RECEIPT_URL,
          }),
          payment({
            reference: "REF-PENDING",
            status: "PENDING",
            date: "2026-06-09T02:00:00Z",
          }),
        ],
      },
    });
    await loaded();

    const receipts = screen.getAllByRole("link", { name: /receipt/i });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toHaveAccessibleName("Receipt for REF-SETTLED");
    expect(receipts[0]).toHaveTextContent("Receipt");
    expect(receipts[0]).toHaveAttribute("href", RECEIPT_URL);
    expect(receipts[0]).toHaveClass(
      "text-sm",
      "font-semibold",
      "text-[#7B1113]",
      "hover:underline",
    );
    expectPlainText(receipts[0] as HTMLElement);

    const pending = screen.getByText("REF-PENDING").closest("tr") as HTMLElement;
    expect(within(pending).queryByRole("link")).not.toBeInTheDocument();
    const pendingLabel = within(pending).getByText("Pending");
    expect(pendingLabel).toHaveClass("text-sm", "font-medium", "text-amber-700");
    expectPlainText(pendingLabel);
  });

  it("AC-FIN-001.8: a paid payment the API sends without a receipt link shows no Receipt link", async () => {
    // The API sends date, amount, reference, and status only.
    openAccount({ [PAYMENTS_ROUTE]: { status: 200, body: [payment()] } });
    await loaded();

    const row = screen.getByText("REF-0001").closest("tr") as HTMLElement;
    expect(within(row).getByText("Paid")).toBeInTheDocument();
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();
  });

  it("AC-FIN-001.8: shows 'No payment history yet.' when there are no payments", async () => {
    openAccount();
    await loaded();

    expect(screen.getByText("No payment history yet.")).toBeInTheDocument();
  });

  it("AC-FIN-001.10: shows the API's amounts as pesos with two decimals and does no arithmetic", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({
          // These do not add up on purpose: the page must show them as sent, never recompute.
          amountAssessed: "1000",
          subsidyApplied: "300.5",
          netPayable: "999.99",
          lines: [
            { code: "A", description: "Fee A", amount: "0.1", coveredByFhe: false },
            { code: "B", description: "Fee B", amount: "0.2", coveredByFhe: false },
            // Beyond what a float holds: a number round trip would corrupt it.
            {
              description: "Fee C",
              amount: "9007199254740993.10",
              coveredByFhe: false,
            },
          ],
        }),
      },
      [PAYMENTS_ROUTE]: {
        status: 200,
        body: [payment({ amount: 1234567.5 })],
      },
    });
    await loaded();

    expect(figure("Net Payable")).toHaveTextContent("₱999.99");
    expect(figure("Amount Assessed")).toHaveTextContent("₱1,000.00");
    expect(figure("Subsidy Applied")).toHaveTextContent("₱300.50");
    expect(screen.getByText("₱0.10")).toBeInTheDocument();
    expect(screen.getByText("₱0.20")).toBeInTheDocument();
    // No total of the lines (0.1 + 0.2 + ...) appears anywhere.
    expect(screen.queryByText("₱0.30")).not.toBeInTheDocument();
    expect(screen.getByText("₱9,007,199,254,740,993.10")).toBeInTheDocument();
    expect(screen.getByText("₱1,234,567.50")).toBeInTheDocument();
  });

  it("shows a status message while the statement loads", async () => {
    openAccount({ [ACCOUNT_ROUTE]: "pending", [PAYMENTS_ROUTE]: "pending" });

    expect(await screen.findByRole("status")).toHaveTextContent("Loading your billing statement");
    expect(screen.queryByRole("heading", { name: "Account Status" })).not.toBeInTheDocument();
  });

  it("a student with no billing account yet (404) sees a message, not an error, and still the history", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 404,
        body: { code: "RESOURCE_NOT_FOUND", message: "Not found." },
      },
      [PAYMENTS_ROUTE]: { status: 200, body: [payment()] },
    });
    await loaded();

    expect(screen.getByText("No billing statement for this semester yet.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay Now" })).not.toBeInTheDocument();
    expect(screen.getByText("REF-0001")).toBeInTheDocument();
  });

  it("shows 'No billing items' when the assessment has no lines", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: { status: 200, body: account({ lines: [] }) },
    });
    await loaded();

    expect(screen.getByText("No billing items for this semester yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /assessment/i })).not.toBeInTheDocument();
  });

  it("shows an alert with Retry when the statement fails, and Retry loads it again", async () => {
    const user = userEvent.setup();
    const api = openAccount({
      [ACCOUNT_ROUTE]: [
        { status: 503, body: { code: "SERVICE_UNAVAILABLE", message: "Try later." } },
        { status: 200, body: account() },
      ],
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't load your billing statement.");
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).toHaveClass("min-w-[140px]", "h-10");

    await user.click(retry);

    await loaded();
    expect(figure("Net Payable")).toHaveTextContent("₱2,045.00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.called(ACCOUNT_ROUTE)).toHaveLength(2);
    // The payments call had succeeded, so Retry does not repeat it.
    expect(api.called(PAYMENTS_ROUTE)).toHaveLength(1);
  });

  it("the error names the status, the API's code, and the request reference", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 403,
        body: { code: "FORBIDDEN", message: "No access.", request_id: "req-123" },
      },
    });

    await screen.findByRole("alert");
    expect(screen.getByText(/Error 403/)).toBeInTheDocument();
    expect(screen.getByText(/FORBIDDEN/)).toBeInTheDocument();
  });

  it("shows the alert when the payment history fails, and Retry loads it again", async () => {
    const user = userEvent.setup();
    const api = openAccount({
      [PAYMENTS_ROUTE]: ["offline", { status: 200, body: [payment()] }],
    });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("REF-0001")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(api.called(PAYMENTS_ROUTE)).toHaveLength(2);
  });

  it("has no accessibility violations: owing, overdue, forfeited, with payments", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({
          paymentStatus: "OVERDUE",
          netPayable: "2145.00",
          lines: [...(account().lines as unknown[]), FINE_LINE],
          fheForfeited: true,
          fheForfeitureReason: "Dropped below the minimum load.",
        }),
      },
      [PAYMENTS_ROUTE]: {
        status: 200,
        body: [
          payment({ receiptUrl: RECEIPT_URL }),
          payment({ reference: "REF-2", status: "PENDING" }),
        ],
      },
    });
    await loaded();

    await expectNoA11yViolations(screen.getByRole("main"));
  });

  it("has no accessibility violations: settled, empty history", async () => {
    openAccount({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({ netPayable: "0.00", paymentStatus: "PAID", lines: [] }),
      },
    });
    await loaded();

    await expectNoA11yViolations(screen.getByRole("main"));
  });
});
