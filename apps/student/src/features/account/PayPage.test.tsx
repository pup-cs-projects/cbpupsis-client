import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const ACCOUNT_ROUTE = "GET /student/account";
const PAY_ROUTE = "POST /student/payments";
const PAYMENT_ROUTE = "GET /student/payments/pay-1";
const RECEIPT_ROUTE = "GET /student/payments/pay-1/receipt";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = Record<string, unknown>;
type Routes = Parameters<typeof mockApi>[0];

/** What GET /student/account sends for a student who owes ₱2,045.00 and is late. */
function account(overrides: Body = {}): Body {
  return {
    amountAssessed: "3000.00",
    subsidyApplied: "1000.00",
    netPayable: "2045.00",
    paymentStatus: "OVERDUE",
    fheForfeited: false,
    fheForfeitureReason: null,
    overdueAmount: "2045.00",
    penaltyAmount: "204.50",
    processingFee: "15.00",
    totalAmountDue: "2264.50",
    lines: [],
    ...overrides,
  };
}

const accepted = { id: "pay-1", status: "PENDING" };

function payment(overrides: Body = {}): Body {
  return {
    id: "pay-1",
    status: "SETTLED",
    reference: "PUP-2026-004521",
    method: "EWALLET",
    processedAt: "2026-11-17T06:42:00Z",
    amount: "1500.00",
    processingFee: "15.00",
    lateFees: "0.00",
    totalAmountPaid: "1515.00",
    newBalance: "545.00",
    failureReason: null,
    ...overrides,
  };
}

function openPay(routes: Routes = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [ACCOUNT_ROUTE]: { status: 200, body: account() },
    ...routes,
  });
  renderApp("/account/pay");
  return api;
}

async function loaded() {
  await screen.findByRole("heading", { name: "Payment Summary" });
}

const payButton = () => screen.getByRole("button", { name: "Pay" });
const amountField = () => screen.getByLabelText("Amount to pay");

/** Every request the page sent, as fetch saw it. */
function requests() {
  return vi.mocked(fetch).mock.calls.map(([input, init]) => ({
    method: init?.method ?? "GET",
    path: new URL(String(input)).pathname.replace(/^\/api\/v1/, ""),
    idempotencyKey: new Headers(init?.headers).get("Idempotency-Key"),
  }));
}

const paymentPosts = () =>
  requests().filter((call) => call.method === "POST" && call.path === "/student/payments");

afterEach(() => {
  session.signOut();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PayPage layout", () => {
  it("shows the Finance breadcrumb, the Make Payment title, and its subtitle", async () => {
    openPay();
    await loaded();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Finance>Billing & Payments>Make Payment");
    expect(within(breadcrumb).getByRole("list")).toHaveClass(
      "text-xs",
      "text-neutral-500",
      "mb-3",
      "flex",
      "items-center",
      "gap-1.5",
    );
    expect(within(breadcrumb).getByText("Make Payment")).toHaveClass(
      "font-semibold",
      "text-neutral-800",
    );
    expect(within(breadcrumb).getByRole("link", { name: "Billing & Payments" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByRole("heading", { level: 1, name: "Make Payment" })).toHaveClass(
      "text-3xl",
      "sm:text-4xl",
      "font-bold",
      "text-[#7B1113]",
      "tracking-tight",
    );
    expect(screen.getByText("Settle your outstanding balance securely.")).toHaveClass(
      "text-sm",
      "text-neutral-600",
      "mt-1.5",
      "mb-8",
    );
  });

  it("lays the checkout out as inputs on the left and a sticky summary with the actions on the right", async () => {
    openPay();
    await loaded();

    const method = screen.getByRole("heading", { name: "Payment Method" }).closest("section");
    const amount = screen.getByRole("heading", { name: "Payment Amount" }).closest("section");
    const summary = screen.getByRole("heading", { name: "Payment Summary" }).closest("section");
    const grid = summary?.parentElement;
    expect(grid).toHaveClass("grid", "grid-cols-1", "lg:grid-cols-12", "gap-6", "items-start");

    // Left: both inputs, in one 7-column stack. Right: the summary, 5 columns, sticky.
    expect(method?.parentElement).toBe(amount?.parentElement);
    expect(method?.parentElement).toHaveClass("lg:col-span-7", "space-y-6");
    expect(method?.parentElement?.parentElement).toBe(grid);
    expect(within(amount as HTMLElement).getByLabelText("Amount to pay")).toBeInTheDocument();
    expect(summary).toHaveClass("lg:col-span-5", "lg:sticky", "lg:top-6");
    for (const card of [method, amount, summary]) {
      expect(card).toHaveClass("bg-white", "border", "rounded-2xl", "p-6", "shadow-sm");
    }

    // The fee breakdown, the total, and both buttons are in the summary; the input is not.
    const inSummary = within(summary as HTMLElement);
    expect(inSummary.getByText("Outstanding Balance")).toBeInTheDocument();
    expect(inSummary.getByText("Total Amount Due")).toBeInTheDocument();
    expect(inSummary.getByRole("button", { name: "Pay" })).toBeInTheDocument();
    expect(inSummary.getByRole("link", { name: "Cancel" })).toBeInTheDocument();
    expect(inSummary.queryByLabelText("Amount to pay")).not.toBeInTheDocument();
    expect(payButton().parentElement).toHaveClass(
      "flex-col",
      "sm:flex-row",
      "lg:flex-col",
      "xl:flex-row",
      "gap-3",
      "mt-6",
    );
    expect(inSummary.getByText("₱2,264.50")).toHaveClass("text-3xl", "lg:text-3xl");
    expect(
      inSummary.getByText(
        "Single-submission protection active. Your account updates automatically upon confirmation.",
      ),
    ).toHaveClass("flex", "items-center", "gap-2", "text-xs", "text-neutral-500", "mt-4");
  });

  it("describes each payment method in one line without changing its name", async () => {
    openPay();
    await loaded();

    const wallet = screen.getByRole("radio", { name: "E-Wallet" });
    const bank = screen.getByRole("radio", { name: "Bank Transfer" });
    expect(wallet).toHaveAccessibleDescription("GCash, Maya, GrabPay");
    expect(bank).toHaveAccessibleDescription("InstaPay / PESONet online banking");
    expect(screen.getByText("GCash, Maya, GrabPay")).toHaveClass("text-xs", "text-neutral-500");
  });

  it("centres the result screens in a narrower column", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: { status: 201, body: accepted },
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await loaded();
    await user.click(payButton());

    const heading = await screen.findByRole("heading", { name: "Payment Successful" });
    expect(heading.parentElement?.parentElement).toHaveClass("max-w-2xl", "mx-auto");
  });

  it("lists E-Wallet and Bank Transfer, with E-Wallet selected and a plain-text style change", async () => {
    const user = userEvent.setup();
    openPay();
    await loaded();

    const group = screen.getByRole("radiogroup", { name: "Payment Method" });
    const wallet = within(group).getByRole("radio", { name: "E-Wallet" });
    const bank = within(group).getByRole("radio", { name: "Bank Transfer" });
    expect(wallet).toBeChecked();
    expect(wallet.closest("label")).toHaveClass("border-2", "border-[#7B1113]", "font-semibold");
    expect(bank.closest("label")).toHaveClass("border", "border-neutral-300");

    await user.click(bank);
    expect(bank).toBeChecked();
    expect(bank.closest("label")).toHaveClass("border-2", "border-[#7B1113]");
    expect(wallet.closest("label")).not.toHaveClass("border-2");
  });

  it("shows the API's figures word for word, two decimals, right-aligned and tabular", async () => {
    openPay();
    await loaded();

    for (const [label, value] of [
      ["Outstanding Balance", "₱2,045.00"],
      ["Processing Fee", "₱15.00"],
      ["Late Fees", "₱204.50"],
      ["Total Amount Due", "₱2,264.50"],
    ]) {
      const amount = screen.getByText(label, { selector: "dt" }).nextElementSibling;
      expect(amount).toHaveTextContent(value);
      expect(amount).toHaveClass("tabular-nums", "text-right");
    }
    expect(screen.getByText("₱2,264.50")).toHaveClass(
      "text-3xl",
      "sm:text-4xl",
      "font-bold",
      "text-[#7B1113]",
    );
    expect(amountField()).toHaveValue("2045.00");
    expect(payButton()).toHaveClass("min-w-[180px]", "h-11", "bg-[#7B1113]");
    const cancel = screen.getByRole("link", { name: "Cancel" });
    expect(cancel).toHaveAttribute("href", "/account");
    expect(cancel).toHaveClass("min-w-[160px]", "h-11");
    expect(payButton().parentElement).toHaveClass("flex-col", "sm:flex-row", "gap-3", "mt-6");
  });

  it("falls back to the net payable as the total when the API sends no total", async () => {
    openPay({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({ totalAmountDue: null, processingFee: null, penaltyAmount: null }),
      },
    });
    await loaded();

    expect(
      screen.getByText("Total Amount Due", { selector: "dt" }).nextElementSibling,
    ).toHaveTextContent("₱2,045.00");
    expect(
      screen.getByText("Processing Fee", { selector: "dt" }).nextElementSibling,
    ).toHaveTextContent("₱0.00");
  });

  it("will not send a payment when nothing is owed", async () => {
    openPay({
      [ACCOUNT_ROUTE]: { status: 200, body: account({ netPayable: "0.00", totalAmountDue: null }) },
    });
    await loaded();

    expect(payButton()).toBeDisabled();
    expect(screen.getByText("You have no outstanding balance.")).toBeInTheDocument();
  });

  it("sends an unreadable amount nowhere and says what to enter", async () => {
    const user = userEvent.setup();
    openPay();
    await loaded();

    await user.clear(amountField());
    await user.type(amountField(), "12abc");
    await user.click(payButton());

    expect(amountField()).toHaveAccessibleDescription("Enter an amount in pesos, such as 1500.00.");
    expect(paymentPosts()).toHaveLength(0);
  });

  it("says why, and offers a retry, when the balance will not load", async () => {
    const user = userEvent.setup();
    openPay({
      [ACCOUNT_ROUTE]: [
        { status: 500, body: { detail: "The billing service is down." } },
        { status: 200, body: account() },
      ],
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("The billing service is down.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await loaded();
  });
});

describe("AC-FIN-002.1, AC-FIN-002.2, AC-FIN-002.3: one payment, one key", () => {
  it("AC-FIN-002.1: sends a UUID Idempotency-Key on the POST and on no GET", async () => {
    const user = userEvent.setup();
    const api = openPay({
      [PAY_ROUTE]: { status: 201, body: accepted },
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await loaded();

    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    const posts = paymentPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].idempotencyKey).toMatch(UUID);
    expect(api.called(PAY_ROUTE)[0]).toMatchObject({
      body: { amount: "2045.00", method: "EWALLET" },
      authorization: "Bearer access-1",
    });
    const gets = requests().filter((call) => call.method === "GET");
    expect(gets.length).toBeGreaterThanOrEqual(2);
    for (const get of gets) expect(get.idempotencyKey).toBeNull();
  });

  it("AC-FIN-002.1: sends the amount as text and the method the student chose", async () => {
    const user = userEvent.setup();
    const api = openPay({
      [PAY_ROUTE]: { status: 201, body: accepted },
      [PAYMENT_ROUTE]: { status: 200, body: payment({ method: "BANK_TRANSFER" }) },
    });
    await loaded();

    await user.click(screen.getByRole("radio", { name: "Bank Transfer" }));
    await user.clear(amountField());
    await user.type(amountField(), "1500.00");
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    expect(api.called(PAY_ROUTE)[0].body).toEqual({ amount: "1500.00", method: "BANK_TRANSFER" });
  });

  it("AC-FIN-002.2, AC-FIN-002.3: a double click on Pay sends one POST, with one key, and locks the form", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: "pending" });
    await loaded();

    await user.dblClick(payButton());

    const busy = await screen.findByRole("button", { name: "Processing…" });
    expect(busy).toBeDisabled();
    await user.click(busy);
    expect(paymentPosts()).toHaveLength(1);
    expect(paymentPosts()[0].idempotencyKey).toMatch(UUID);
    expect(screen.getByRole("radio", { name: "Bank Transfer" })).toBeDisabled();
    expect(amountField()).toBeDisabled();
  });

  it("AC-FIN-002.1: a retry after a network error keeps the same Idempotency-Key", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: ["offline", { status: 201, body: accepted }],
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await loaded();

    await user.click(payButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("you will not be charged twice");
    // The form is usable again, and says nothing of failure.
    await waitFor(() => expect(payButton()).toBeEnabled());
    expect(screen.queryByText("Payment Failed")).not.toBeInTheDocument();

    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    const keys = paymentPosts().map((call) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(UUID);
    expect(keys[1]).toBe(keys[0]);
  });

  it("AC-FIN-002.1: a retry with a different amount is a different payment, with a new key", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: ["offline", { status: 201, body: accepted }],
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await loaded();

    await user.click(payButton());
    await screen.findByRole("alert");
    await waitFor(() => expect(payButton()).toBeEnabled());
    await user.clear(amountField());
    await user.type(amountField(), "500.00");
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    const [first, second] = paymentPosts().map((call) => call.idempotencyKey);
    expect(second).not.toBe(first);
  });
});

describe("AC-FIN-002.10: a gateway failure", () => {
  const gatewayError = {
    status: 502,
    body: {
      code: "PAYMENT_GATEWAY_ERROR",
      detail: "The payment gateway could not complete the payment.",
      details: {
        reference: "PUP-2026-004522",
        reason: "Insufficient Funds",
        occurred_at: "2026-11-17T06:42:00Z",
      },
    },
  };

  it("shows Payment Failed with the gateway's own reason, and never says the account was updated", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: gatewayError });
    await loaded();

    await user.click(payButton());

    const heading = await screen.findByRole("heading", { name: "Payment Failed" });
    expect(heading).toHaveClass("text-2xl", "sm:text-3xl", "font-bold", "text-red-600");
    expect(heading).toHaveFocus();
    expect(
      screen.getByText(/No payment was completed and your balance remains unchanged/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Your account has been updated/)).not.toBeInTheDocument();
    expect(screen.queryByText("Payment Successful")).not.toBeInTheDocument();

    const row = (label: string) =>
      screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
    expect(row("Reference Number")).toHaveTextContent("PUP-2026-004522");
    expect(row("Date & Time")).toHaveTextContent("November 17, 2026");
    expect(row("Status")).toHaveTextContent("Failed");
    expect(row("Reason")).toHaveTextContent("Insufficient Funds");
    // The balance did not change: the same total the form showed.
    expect(row("Total Amount Due")).toHaveTextContent("₱2,264.50");
    // A plain label, not a pill.
    const status = within(row("Status")).getByText("Failed");
    expect(
      Array.from(status.classList).filter((name) => /^(rounded|bg-|border|px-|py-)/.test(name)),
    ).toEqual([]);
  });

  it("AC-FIN-002.10: Try again starts a new attempt with a brand-new Idempotency-Key", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: [gatewayError, { status: 201, body: accepted }],
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await loaded();

    await user.click(payButton());
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    // Back on the form, as it was left.
    expect(await screen.findByRole("heading", { name: "Payment Summary" })).toBeInTheDocument();
    expect(amountField()).toHaveValue("2045.00");
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    const keys = paymentPosts().map((call) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(UUID);
    expect(keys[1]).toMatch(UUID);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("shows a payment the gateway failed later, found by polling, as the same failure", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: { status: 201, body: accepted },
      [PAYMENT_ROUTE]: {
        status: 200,
        body: payment({ status: "FAILED", failureReason: "Card Declined", newBalance: null }),
      },
    });
    await loaded();

    await user.click(payButton());

    await screen.findByRole("heading", { name: "Payment Failed" });
    expect(screen.getByText("Reason", { selector: "dt" }).nextElementSibling).toHaveTextContent(
      "Card Declined",
    );
  });
});

describe("AC-FIN-002.4: a payment still in progress", () => {
  it("shows 'Your payment is still processing.' and asks again after the Retry-After interval", async () => {
    const user = userEvent.setup();
    const api = openPay({
      [PAY_ROUTE]: {
        status: 409,
        headers: { "Retry-After": "1" },
        body: {
          code: "PAYMENT_IN_PROGRESS",
          detail: "A payment for this request is already being processed.",
          details: { payment_id: "pay-1" },
        },
      },
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await loaded();

    await user.click(payButton());

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your payment is still processing.",
    );
    // Locked, and not asked yet: the API said to wait.
    expect(payButton()).toBeDisabled();
    expect(api.called(PAYMENT_ROUTE)).toHaveLength(0);

    // After the interval the page asks, and shows what the API now says.
    expect(
      await screen.findByRole("heading", { name: "Payment Successful" }, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(api.called(PAYMENT_ROUTE)).toHaveLength(1);
    expect(paymentPosts()).toHaveLength(1);
  });

  it("keeps asking while the payment is pending", async () => {
    const user = userEvent.setup();
    const api = openPay({
      [PAY_ROUTE]: {
        status: 409,
        headers: { "Retry-After": "1" },
        body: { code: "PAYMENT_IN_PROGRESS", details: { payment_id: "pay-1" } },
      },
      [PAYMENT_ROUTE]: [
        { status: 200, body: payment({ status: "PENDING", reference: null, newBalance: null }) },
        { status: 200, body: payment() },
      ],
    });
    await loaded();

    await user.click(payButton());
    await waitFor(() => expect(api.called(PAYMENT_ROUTE)).toHaveLength(1), { timeout: 3000 });
    expect(screen.getByRole("status")).toHaveTextContent("Your payment is still processing.");
    expect(payButton()).toBeDisabled();
  });
});

describe("a gateway timeout", () => {
  it("shows 'We are confirming your payment. Do not pay again.' and keeps Pay disabled", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: {
        status: 504,
        body: { code: "PAYMENT_GATEWAY_TIMEOUT", details: { payment_id: "pay-1" } },
      },
      [PAYMENT_ROUTE]: { status: 200, body: payment({ status: "PENDING" }) },
    });
    await loaded();

    await user.click(payButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We are confirming your payment. Do not pay again.",
    );
    expect(payButton()).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Bank Transfer" })).toBeDisabled();
    expect(paymentPosts()).toHaveLength(1);
  });

  it("still keeps Pay disabled when the 504 names no payment to follow", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: { status: 504, body: { code: "PAYMENT_GATEWAY_TIMEOUT" } } });
    await loaded();

    await user.click(payButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Do not pay again.");
    expect(payButton()).toBeDisabled();
    expect(screen.getByText(/Check Billing & Payments/)).toBeInTheDocument();
  });
});

describe("a refused amount", () => {
  it("shows the API's 422 AMOUNT_EXCEEDS_BALANCE message on the amount field", async () => {
    const user = userEvent.setup();
    const message = "The amount is more than your outstanding balance of 2045.00.";
    openPay({
      [PAY_ROUTE]: {
        status: 422,
        body: { code: "AMOUNT_EXCEEDS_BALANCE", detail: message },
      },
    });
    await loaded();

    await user.clear(amountField());
    await user.type(amountField(), "9999.00");
    await user.click(payButton());

    await waitFor(() => expect(amountField()).toHaveAttribute("aria-invalid", "true"));
    expect(amountField()).toHaveAccessibleDescription(message);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    // The student can correct it and send again, with a new key.
    expect(payButton()).toBeEnabled();
    await user.type(amountField(), "{Backspace}");
    expect(amountField()).toHaveAttribute("aria-invalid", "false");
  });

  it("uses a new key for the corrected amount after a 422", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: [
        { status: 422, body: { code: "AMOUNT_EXCEEDS_BALANCE", detail: "Too much." } },
        { status: 201, body: accepted },
      ],
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await loaded();

    await user.click(payButton());
    await screen.findByText("Too much.");
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    const [first, second] = paymentPosts().map((call) => call.idempotencyKey);
    expect(second).not.toBe(first);
  });
});

describe("AC-FIN-002.9: a successful payment", () => {
  function openSuccess(routes: Routes = {}) {
    return openPay({
      [PAY_ROUTE]: { status: 201, body: accepted },
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
      ...routes,
    });
  }

  it("shows the reference, how it was paid, when, the new balance, and the breakdown, from the payment", async () => {
    const user = userEvent.setup();
    openSuccess();
    await loaded();

    await user.click(payButton());

    const heading = await screen.findByRole("heading", { name: "Payment Successful" });
    expect(heading).toHaveClass("text-2xl", "sm:text-3xl", "font-bold", "text-emerald-600");
    expect(heading).toHaveFocus();
    expect(
      screen.getByText("Your account has been updated and confirmation was sent by email."),
    ).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-circle-check")).toHaveClass("text-emerald-600");

    const row = (label: string) =>
      screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;
    expect(row("Reference Number")).toHaveTextContent("PUP-2026-004521");
    expect(row("Paid via")).toHaveTextContent("E-Wallet");
    expect(row("Date & Time")).toHaveTextContent("November 17, 2026 • 2:42 PM");
    expect(row("New Balance")).toHaveTextContent("₱545.00");
    expect(row("Payment Amount")).toHaveTextContent("₱1,500.00");
    expect(row("Processing Fee")).toHaveTextContent("₱15.00");
    expect(row("Late Fees")).toHaveTextContent("₱0.00");
    expect(row("Total Amount Paid")).toHaveTextContent("₱1,515.00");
    expect(row("Total Amount Paid")).toHaveClass("tabular-nums");
    expect(screen.queryByText("Payment Failed")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Billing & Payments" })).toHaveAttribute(
      "href",
      "/account",
    );
  });

  it("downloads the receipt from GET /student/payments/{payment_id}/receipt", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:receipt");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const api = openSuccess({ [RECEIPT_ROUTE]: { status: 200, body: { receipt: true } } });
    await loaded();
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    await user.click(screen.getByRole("button", { name: "Download Receipt" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(api.called(RECEIPT_ROUTE)).toHaveLength(1);
    expect(api.called(RECEIPT_ROUTE)[0].authorization).toBe("Bearer access-1");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:receipt");
    // A receipt is a GET: no Idempotency-Key.
    expect(requests().find((call) => call.path.endsWith("/receipt"))?.idempotencyKey).toBeNull();
  });

  it("says so, and keeps the button, when the receipt cannot be downloaded", async () => {
    const user = userEvent.setup();
    openSuccess({
      [RECEIPT_ROUTE]: { status: 404, body: { detail: "The receipt is not ready yet." } },
    });
    await loaded();
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    await user.click(screen.getByRole("button", { name: "Download Receipt" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The receipt is not ready yet.");
    expect(screen.getByRole("button", { name: "Download Receipt" })).toBeEnabled();
  });

  it("has no accessibility violations", async () => {
    const user = userEvent.setup();
    openSuccess();
    await loaded();
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Successful" });

    await expectNoA11yViolations(screen.getByRole("main"));
  });
});

describe("accessibility of the other states", () => {
  it("the form has no violations", async () => {
    openPay();
    await loaded();

    await expectNoA11yViolations(screen.getByRole("main"));
  });

  it("the failed state has no violations", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: {
        status: 502,
        body: { code: "PAYMENT_GATEWAY_ERROR", details: { reason: "Insufficient Funds" } },
      },
    });
    await loaded();
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Failed" });

    await expectNoA11yViolations(screen.getByRole("main"));
  });

  it("the timeout state has no violations", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: { status: 504, body: { code: "PAYMENT_GATEWAY_TIMEOUT" } } });
    await loaded();
    await user.click(payButton());
    await screen.findByText("We are confirming your payment. Do not pay again.");

    await expectNoA11yViolations(screen.getByRole("main"));
  });
});
