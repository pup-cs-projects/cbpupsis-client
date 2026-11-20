import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";
import { checkout } from "./usePayment";

// US-FIN-002, against the shapes cbpupsis-api#85 sends (docs/openapi.json). The student pays on
// the gateway's hosted page: POST creates the checkout, the gateway sends the student back to
// /payments/success or /payments/cancel, and GET /student/payments/{id} says how it ended.

const ID = "2b9d4a3e-6f1c-4a8e-9a57-3f0c8e1d7b11";
const OTHER_ID = "9c1e7b52-0d4a-4c3f-8b6e-1a2f3d4e5f60";
const CHECKOUT_URL = "https://checkout.xendit.co/web/abc";
const ACCOUNT_ROUTE = "GET /student/account";
const PAY_ROUTE = "POST /student/payments";
const PAYMENT_ROUTE = `GET /student/payments/${ID}`;
const RECEIPT_ROUTE = `GET /student/payments/${ID}/receipt`;
const PENDING_KEY = "cbpupsis.pay.pending";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = Record<string, unknown>;
type Routes = Parameters<typeof mockApi>[0];

/** What GET /student/account sends (AccountRead) for a student who owes ₱2,145.00, fine included. */
function account(overrides: Body = {}): Body {
  return {
    amountAssessed: "3000.00",
    subsidyApplied: "1000.00",
    netPayable: "2145.00",
    paymentStatus: "OVERDUE",
    holds: [],
    lines: [
      { description: "Tuition", amount: "1000.00", coveredByFhe: true },
      { description: "Laboratory fee", amount: "2045.00", coveredByFhe: false },
      { description: "Late payment fine", amount: "100.00", coveredByFhe: false },
    ],
    fheQualified: true,
    fheForfeited: false,
    fheForfeitureReason: null,
    ...overrides,
  };
}

/** 201 from POST /student/payments. */
const created = { paymentId: ID, state: "PENDING", checkoutUrl: CHECKOUT_URL };

/** GET /student/payments/{payment_id} (PaymentDetailRead). */
function payment(overrides: Body = {}): Body {
  return {
    paymentId: ID,
    state: "PAID",
    amount: "1500.00",
    currency: "PHP",
    gatewayReference: "xnd-pay-8f3a1c",
    receiptNumber: "RCPT-2026-004521",
    paidAt: "2026-11-18T06:42:00Z",
    createdAt: "2026-11-18T06:40:00Z",
    ...overrides,
  };
}

const pending = { state: "PENDING", gatewayReference: null, receiptNumber: null, paidAt: null };

function open(path: string, routes: Routes = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [ACCOUNT_ROUTE]: { status: 200, body: account() },
    ...routes,
  });
  renderApp(path);
  return api;
}

const openPay = (routes: Routes = {}) => open("/account/pay", routes);

/** Back from the gateway's page, with the payment remembered from before the trip. */
function openReturn(path: "/payments/success" | "/payments/cancel", routes: Routes = {}) {
  sessionStorage.setItem(PENDING_KEY, ID);
  return open(path, routes);
}

async function loaded() {
  await screen.findByRole("heading", { name: "Payment Summary" });
}

const payButton = () => screen.getByRole("button", { name: "Pay" });
const amountField = () => screen.getByLabelText("Amount to pay");
const row = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling as HTMLElement;

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

let go: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // The trip to the gateway's page: leave the test page where it is.
  go = vi.spyOn(checkout, "go").mockReturnValue(true);
});

afterEach(() => {
  session.signOut();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PayPage layout", () => {
  it("shows the Finance breadcrumb, the Make Payment title, and its subtitle", async () => {
    openPay();
    await loaded();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Finance>Billing & Payments>Make Payment");
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

    const checkoutCard = screen
      .getByRole("heading", { name: "Secure Checkout" })
      .closest("section");
    const amount = screen.getByRole("heading", { name: "Payment Amount" }).closest("section");
    const summary = screen.getByRole("heading", { name: "Payment Summary" }).closest("section");
    const grid = summary?.parentElement;
    expect(grid).toHaveClass("grid", "grid-cols-1", "lg:grid-cols-12", "gap-6", "items-start");

    expect(checkoutCard?.parentElement).toBe(amount?.parentElement);
    expect(amount?.parentElement).toHaveClass("lg:col-span-7", "space-y-6");
    expect(amount?.parentElement?.parentElement).toBe(grid);
    expect(within(amount as HTMLElement).getByLabelText("Amount to pay")).toBeInTheDocument();
    expect(summary).toHaveClass("lg:col-span-5", "lg:sticky", "lg:top-6");
    for (const card of [checkoutCard, amount, summary]) {
      expect(card).toHaveClass("bg-white", "border", "rounded-2xl", "p-6", "shadow-sm");
    }

    const inSummary = within(summary as HTMLElement);
    expect(inSummary.getByText("Outstanding Balance")).toBeInTheDocument();
    expect(inSummary.getByText("Total Amount Due")).toBeInTheDocument();
    expect(inSummary.getByRole("button", { name: "Pay" })).toBeInTheDocument();
    expect(inSummary.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/account");
    expect(inSummary.queryByLabelText("Amount to pay")).not.toBeInTheDocument();
    expect(payButton().parentElement).toHaveClass(
      "flex-col",
      "sm:flex-row",
      "lg:flex-col",
      "xl:flex-row",
      "gap-3",
      "mt-6",
    );
    expect(payButton()).toHaveClass("min-w-[180px]", "h-11", "bg-[#7B1113]");
    // Pay (a button) and Cancel (a link) share one font: the `!` beats theme.css's unlayered
    // `button { font: inherit }`, which would otherwise leave Pay at 16px regular.
    const cancel = screen.getByRole("link", { name: "Cancel" });
    for (const control of [payButton(), cancel]) {
      expect(control).toHaveClass("text-sm!", "font-semibold!", "h-11");
    }
    expect(
      inSummary.getByText(
        "Single-submission protection active. Your account updates automatically upon confirmation.",
      ),
    ).toHaveClass("flex", "items-center", "gap-2", "text-xs", "text-neutral-500", "mt-4");
  });

  it("offers no payment method: the API takes none, and the gateway's page asks for it", async () => {
    openPay();
    await loaded();

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText(/You choose how to pay on our payment partner/)).toBeInTheDocument();
  });

  it("shows the API's figures word for word, two decimals, right-aligned and tabular", async () => {
    openPay();
    await loaded();

    for (const [label, value] of [
      ["Outstanding Balance", "₱2,145.00"],
      ["Processing Fee", "₱0.00"],
      ["Late Fees", "₱100.00"],
      ["Total Amount Due", "₱2,145.00"],
    ]) {
      expect(row(label)).toHaveTextContent(value);
      expect(row(label)).toHaveClass("tabular-nums", "text-right");
    }
    expect(row("Total Amount Due")).toHaveClass(
      "text-3xl",
      "sm:text-4xl",
      "font-bold",
      "text-[#7B1113]",
    );
    expect(
      screen.getByText("Your outstanding balance already includes late fees."),
    ).toBeInTheDocument();
    expect(amountField()).toHaveValue("2145.00");
  });

  it("shows no late-fee note, and ₱0.00 for it, when no fine applies", async () => {
    openPay({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({ paymentStatus: "DUE", netPayable: "2045.00", lines: [] }),
      },
    });
    await loaded();

    expect(row("Late Fees")).toHaveTextContent("₱0.00");
    expect(screen.queryByText(/already includes late fees/)).not.toBeInTheDocument();
  });

  it("will not send a payment when nothing is owed", async () => {
    openPay({
      [ACCOUNT_ROUTE]: {
        status: 200,
        body: account({ netPayable: "0.00", paymentStatus: "PAID", lines: [] }),
      },
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

describe("320px layout", () => {
  // jsdom does no layout, so this checks what makes 320px work rather than measuring it: one
  // column below lg, nothing wider than the phone's 288px of content, and rows that wrap.
  const MOBILE_CONTENT_PX = 320 - 2 * 16;

  it("is one column, with nothing fixed wider than the content area, and rows that wrap", async () => {
    openPay();
    await loaded();

    const summary = screen.getByRole("heading", { name: "Payment Summary" }).closest("section");
    const grid = summary?.parentElement as HTMLElement;
    // Single column until lg: no unprefixed column span, no unprefixed fixed width anywhere.
    expect(grid).toHaveClass("grid-cols-1");
    for (const element of [grid, ...Array.from(grid.querySelectorAll("*"))]) {
      const classes = Array.from(element.classList);
      expect(classes.filter((name) => /^col-span-/.test(name))).toEqual([]);
      expect(classes.filter((name) => /^(w|max-w)-\[\d+px\]$/.test(name))).toEqual([]);
      for (const name of classes) {
        const fixed = /^min-w-\[(\d+)px\]$/.exec(name);
        if (fixed) expect(Number(fixed[1])).toBeLessThanOrEqual(MOBILE_CONTENT_PX);
      }
    }
    // The page may shrink inside the layout, and the controls fill the width they are given.
    expect(grid.closest("main")?.firstElementChild).toHaveClass("min-w-0");
    expect(amountField()).toHaveClass("w-full", "min-w-0");
    expect(payButton().parentElement).toHaveClass("flex-col", "items-stretch");
    // The total's label and figure wrap rather than overflow.
    expect(row("Total Amount Due").parentElement).toHaveClass("flex-wrap");
    expect(payButton().parentElement).not.toHaveClass("flex-nowrap");
  });

  it("keeps the result screens in a column no wider than the screen", async () => {
    openReturn("/payments/success", { [PAYMENT_ROUTE]: { status: 200, body: payment() } });

    const heading = await screen.findByRole("heading", { name: "Payment Successful" });

    const column = heading.parentElement?.parentElement as HTMLElement;
    expect(column).toHaveClass("max-w-2xl", "mx-auto");
    expect(row("Reference Number")).toHaveClass("text-right");
    expect(within(row("Reference Number")).getByText("xnd-pay-8f3a1c")).toHaveClass("break-all");
    expect(
      screen.getByRole("link", { name: "Back to Billing & Payments" }).parentElement,
    ).toHaveClass("flex-col");
  });
});

describe("AC-FIN-002.1, AC-FIN-002.2, AC-FIN-002.3: one payment, one key", () => {
  it("AC-FIN-002.1: sends a UUID Idempotency-Key and only the amount on the POST, and none on any GET", async () => {
    const user = userEvent.setup();
    const api = openPay({ [PAY_ROUTE]: { status: 201, body: created } });
    await loaded();

    await user.click(payButton());
    await screen.findByText("Taking you to the secure payment page.");

    const posts = paymentPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].idempotencyKey).toMatch(UUID);
    expect(api.called(PAY_ROUTE)[0]).toMatchObject({
      body: { amount: "2145.00" },
      authorization: "Bearer access-1",
    });
    for (const get of requests().filter((call) => call.method === "GET")) {
      expect(get.idempotencyKey).toBeNull();
    }
  });

  it("sends the student on to the gateway's hosted checkout, and remembers the payment first", async () => {
    const user = userEvent.setup();
    let rememberedBeforeLeaving: string | null = null;
    go.mockImplementation(() => {
      rememberedBeforeLeaving = sessionStorage.getItem(PENDING_KEY);
      return true;
    });
    openPay({ [PAY_ROUTE]: { status: 201, body: created } });
    await loaded();
    await user.clear(amountField());
    await user.type(amountField(), "1500.00");

    await user.click(payButton());

    await waitFor(() => expect(go).toHaveBeenCalledWith(CHECKOUT_URL));
    expect(rememberedBeforeLeaving).toBe(ID);
    // The form stays locked, with a link in case the redirect is blocked.
    expect(payButton()).toBeDisabled();
    expect(screen.getByRole("link", { name: "continue to payment" })).toHaveAttribute(
      "href",
      CHECKOUT_URL,
    );
    expect(vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body).toBe(
      JSON.stringify({ amount: "1500.00" }),
    );
  });

  it("a created payment that is already PAID needs no trip to the gateway: it is read at once", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: { status: 201, body: { ...created, state: "PAID" } },
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await loaded();

    await user.click(payButton());

    await screen.findByRole("heading", { name: "Payment Successful" });
    expect(go).not.toHaveBeenCalled();
    expect(row("Reference Number")).toHaveTextContent("xnd-pay-8f3a1c");
  });

  it("a created payment that is already FAILED shows the failure, without a trip to the gateway", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: { status: 201, body: { ...created, state: "FAILED" } },
      [PAYMENT_ROUTE]: { status: 200, body: payment({ state: "FAILED", paidAt: null }) },
    });
    await loaded();

    await user.click(payButton());

    await screen.findByRole("heading", { name: "Payment Failed" });
    expect(go).not.toHaveBeenCalled();
  });

  it("will not send the student anywhere but an https address", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: {
        status: 201,
        body: { ...created, checkoutUrl: "http://evil.example.test/pay" },
      },
    });
    await loaded();

    await user.click(payButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("could not read");
    expect(go).not.toHaveBeenCalled();
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
    expect(amountField()).toBeDisabled();
  });

  it("AC-FIN-002.1: a retry after a network error keeps the same Idempotency-Key", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: ["offline", { status: 201, body: created }] });
    await loaded();

    await user.click(payButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("you will not be charged twice");
    await waitFor(() => expect(payButton()).toBeEnabled());
    expect(screen.queryByText("Payment Failed")).not.toBeInTheDocument();

    await user.click(payButton());
    await waitFor(() => expect(go).toHaveBeenCalledWith(CHECKOUT_URL));

    const keys = paymentPosts().map((call) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(UUID);
    expect(keys[1]).toBe(keys[0]);
  });

  it("AC-FIN-002.1: a retry with a different amount is a different payment, with a new key", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: ["offline", { status: 201, body: created }] });
    await loaded();

    await user.click(payButton());
    await screen.findByRole("alert");
    await waitFor(() => expect(payButton()).toBeEnabled());
    await user.clear(amountField());
    await user.type(amountField(), "500.00");
    await user.click(payButton());
    await waitFor(() => expect(go).toHaveBeenCalled());

    const [first, second] = paymentPosts().map((call) => call.idempotencyKey);
    expect(second).not.toBe(first);
  });
});

describe("AC-FIN-002.4: a payment still in progress", () => {
  const inProgress = {
    status: 409,
    headers: { "Retry-After": "1" },
    body: {
      code: "PAYMENT_IN_PROGRESS",
      detail: "A payment with this idempotency key is still being created.",
    },
  };

  it("shows 'Your payment is still processing.', then asks again with the same key after Retry-After", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: [inProgress, { status: 201, body: created }] });
    await loaded();

    await user.click(payButton());

    const processing = await screen.findByText("Your payment is still processing.");
    expect(processing.closest("[role=status]")).toBeInTheDocument();
    // Locked, and not asked again yet: the API said to wait.
    expect(payButton()).toBeDisabled();
    expect(paymentPosts()).toHaveLength(1);

    // After the interval the same request is sent again, and the first call's answer arrives.
    await waitFor(() => expect(go).toHaveBeenCalledWith(CHECKOUT_URL), { timeout: 4000 });
    const keys = paymentPosts().map((call) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(UUID);
    expect(keys[1]).toBe(keys[0]);
  });

  it("back from the gateway before it settles: says so, and asks GET /student/payments/{id} again", async () => {
    const api = openReturn("/payments/success", {
      [PAYMENT_ROUTE]: [
        { status: 200, body: payment(pending) },
        { status: 200, body: payment() },
      ],
    });

    const processing = await screen.findByText("Your payment is still processing.");
    expect(processing.closest("[role=status]")).toBeInTheDocument();
    // The first ask finds it still PENDING: the page stays as it was, locked.
    await waitFor(() => expect(api.called(PAYMENT_ROUTE)).toHaveLength(1));
    expect(screen.getByText("Your payment is still processing.")).toBeInTheDocument();
    expect(payButton()).toBeDisabled();

    await screen.findByRole("heading", { name: "Payment Successful" }, { timeout: 8000 });
    expect(api.called(PAYMENT_ROUTE).length).toBeGreaterThanOrEqual(2);
    expect(paymentPosts()).toHaveLength(0);
  }, 12000);
});

describe("AC-FIN-002.10: a gateway failure", () => {
  const gatewayError = {
    status: 502,
    body: {
      status: "error",
      code: "PAYMENT_GATEWAY_ERROR",
      message: "The payment gateway rejected the request.",
      detail: "The payment gateway rejected the request.",
      reason: "Insufficient Funds",
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

    // A refusal at checkout creates no gateway reference.
    expect(row("Reference Number")).toHaveTextContent("Not issued");
    expect(row("Status")).toHaveTextContent("Failed");
    expect(row("Reason")).toHaveTextContent("Insufficient Funds");
    // The balance did not change: the same total the form showed.
    expect(row("Total Amount Due")).toHaveTextContent("₱2,145.00");
    const status = within(row("Status")).getByText("Failed");
    expect(
      Array.from(status.classList).filter((name) => /^(rounded|bg-|border|px-|py-)/.test(name)),
    ).toEqual([]);
    expect(go).not.toHaveBeenCalled();
  });

  it("AC-FIN-002.10: Try again starts a new attempt with a brand-new Idempotency-Key", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: [gatewayError, { status: 201, body: created }] });
    await loaded();

    await user.click(payButton());
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    // Back on the form, as it was left.
    expect(await screen.findByRole("heading", { name: "Payment Summary" })).toBeInTheDocument();
    expect(amountField()).toHaveValue("2145.00");
    await user.click(payButton());
    await waitFor(() => expect(go).toHaveBeenCalledWith(CHECKOUT_URL));

    const keys = paymentPosts().map((call) => call.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(UUID);
    expect(keys[1]).toMatch(UUID);
    expect(keys[1]).not.toBe(keys[0]);
  });

  it("back from the gateway with a FAILED payment, shows the same failure with its reference", async () => {
    openReturn("/payments/success", {
      [PAYMENT_ROUTE]: {
        status: 200,
        body: payment({ state: "FAILED", paidAt: null, receiptNumber: null }),
      },
    });

    await screen.findByRole("heading", { name: "Payment Failed" });

    expect(row("Reference Number")).toHaveTextContent("xnd-pay-8f3a1c");
    expect(row("Reason")).toHaveTextContent("The payment was not completed.");
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });
});

describe("a gateway timeout", () => {
  it("shows 'We are confirming your payment. Do not pay again.' and keeps Pay disabled, with no second POST", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: {
        status: 504,
        body: {
          code: "PAYMENT_GATEWAY_TIMEOUT",
          detail: "The payment gateway did not respond in time. The attempt remains pending.",
        },
      },
    });
    await loaded();

    await user.click(payButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We are confirming your payment. Do not pay again.");
    expect(within(alert).getByRole("link", { name: "Billing & Payments" })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(payButton()).toBeDisabled();
    expect(amountField()).toBeDisabled();
    expect(paymentPosts()).toHaveLength(1);
    expect(go).not.toHaveBeenCalled();
  });
});

describe("a refused amount", () => {
  const exceeds = {
    status: 422,
    body: {
      code: "AMOUNT_EXCEEDS_BALANCE",
      detail: "The payment amount exceeds the available balance.",
    },
  };

  it("shows the API's 422 AMOUNT_EXCEEDS_BALANCE message on the amount field", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: exceeds });
    await loaded();

    await user.clear(amountField());
    await user.type(amountField(), "9999.00");
    await user.click(payButton());

    const message = "The payment amount exceeds the available balance.";
    await waitFor(() => expect(amountField()).toHaveAttribute("aria-invalid", "true"));
    expect(amountField()).toHaveAccessibleDescription(message);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    // The student can correct it and send again.
    expect(payButton()).toBeEnabled();
    await user.type(amountField(), "{Backspace}");
    expect(amountField()).toHaveAttribute("aria-invalid", "false");
  });

  it("uses a new key for the corrected amount after a 422", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: [exceeds, { status: 201, body: created }] });
    await loaded();

    await user.click(payButton());
    await screen.findByText("The payment amount exceeds the available balance.");
    await user.click(payButton());
    await waitFor(() => expect(go).toHaveBeenCalled());

    const [first, second] = paymentPosts().map((call) => call.idempotencyKey);
    expect(second).not.toBe(first);
  });
});

describe("AC-FIN-002.9: back from the gateway, paid", () => {
  /** The account before the payment, then after it: the balance the student owes now. */
  const accounts = [
    { status: 200, body: account() },
    { status: 200, body: account({ netPayable: "645.00", paymentStatus: "DUE", lines: [] }) },
  ];

  function openPaid(routes: Routes = {}) {
    return openReturn("/payments/success", {
      [ACCOUNT_ROUTE]: accounts,
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
      ...routes,
    });
  }

  it("shows the reference, receipt number, when, the total paid, and the new balance from the account", async () => {
    const api = openPaid();

    const heading = await screen.findByRole("heading", { name: "Payment Successful" });

    expect(heading).toHaveClass("text-2xl", "sm:text-3xl", "font-bold", "text-emerald-600");
    expect(heading).toHaveFocus();
    expect(
      screen.getByText("Your account has been updated and confirmation was sent by email."),
    ).toBeInTheDocument();
    expect(document.querySelector("svg.lucide-circle-check")).toHaveClass("text-emerald-600");
    expect(row("Reference Number")).toHaveTextContent("xnd-pay-8f3a1c");
    expect(row("Receipt Number")).toHaveTextContent("RCPT-2026-004521");
    expect(row("Date & Time")).toHaveTextContent("November 18, 2026 • 2:42 PM");
    expect(row("Total Amount Paid")).toHaveTextContent("₱1,500.00");
    expect(row("Total Amount Paid")).toHaveClass("tabular-nums");
    // The status call carries no balance: it is the account's own figure, read again once PAID.
    await waitFor(() => expect(row("New Balance")).toHaveTextContent("₱645.00"));
    expect(api.called(ACCOUNT_ROUTE).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Payment Failed")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Billing & Payments" })).toHaveAttribute(
      "href",
      "/account",
    );
    // The trip is over: the remembered payment is forgotten, and nothing was sent as a POST.
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    expect(paymentPosts()).toHaveLength(0);
  });

  it("names the payment from ?payment_id= on the return address, ahead of the remembered one", async () => {
    sessionStorage.setItem(PENDING_KEY, OTHER_ID);
    const api = open(`/payments/success?payment_id=${ID}`, {
      [ACCOUNT_ROUTE]: accounts,
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });

    await screen.findByRole("heading", { name: "Payment Successful" });

    expect(api.called(PAYMENT_ROUTE)).toHaveLength(1);
    expect(requests().some((call) => call.path.includes(OTHER_ID))).toBe(false);
  });

  it("reads ?paymentId= too, and ignores a value that is not a payment id", async () => {
    open(`/payments/success?paymentId=${ID}`, {
      [ACCOUNT_ROUTE]: accounts,
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await screen.findByRole("heading", { name: "Payment Successful" });
  });

  it("never sends a ?payment_id= that is not a UUID to the API", async () => {
    open("/payments/success?payment_id=../../account");

    await loaded();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check Billing & Payments before paying again.",
    );
    expect(requests().filter((call) => call.path.startsWith("/student/payments"))).toEqual([]);
  });

  it("downloads the receipt PDF from GET /student/payments/{payment_id}/receipt", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:receipt");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const api = openPaid({ [RECEIPT_ROUTE]: { status: 200, body: { receipt: true } } });
    await screen.findByRole("heading", { name: "Payment Successful" });

    await user.click(screen.getByRole("button", { name: "Download Receipt" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(api.called(RECEIPT_ROUTE)).toHaveLength(1);
    expect(api.called(RECEIPT_ROUTE)[0].authorization).toBe("Bearer access-1");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:receipt");
    expect(requests().find((call) => call.path.endsWith("/receipt"))?.idempotencyKey).toBeNull();
  });

  it("says so, and keeps the button, when the receipt cannot be downloaded", async () => {
    const user = userEvent.setup();
    openPaid({
      [RECEIPT_ROUTE]: {
        status: 409,
        body: { detail: "A receipt is available only after payment settlement." },
      },
    });
    await screen.findByRole("heading", { name: "Payment Successful" });

    await user.click(screen.getByRole("button", { name: "Download Receipt" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A receipt is available only after payment settlement.",
    );
    expect(screen.getByRole("button", { name: "Download Receipt" })).toBeEnabled();
  });
});

describe("coming back from the gateway", () => {
  it("/payments/success is a real route: it never falls through to Not Found", async () => {
    openReturn("/payments/success", { [PAYMENT_ROUTE]: { status: 200, body: payment() } });

    await screen.findByRole("heading", { name: "Payment Successful" });

    expect(screen.queryByText("Not Found")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Make Payment" })).toBeInTheDocument();
  });

  it("/payments/cancel is a real route: leaving without paying shows the form, with a note, and forgets the payment", async () => {
    const api = openReturn("/payments/cancel");

    await loaded();

    expect(screen.queryByText("Not Found")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You left the payment page before it finished.",
    );
    expect(payButton()).toBeEnabled();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
    expect(api.called(PAYMENT_ROUTE)).toHaveLength(0);
  });

  it("/payments/cancel explains the amount stays reserved for about 5 minutes, so an immediate retry may be refused", async () => {
    openReturn("/payments/cancel");

    await loaded();

    const note = screen.getByRole("alert");
    expect(note).toHaveTextContent("stays reserved on your balance for about 5 minutes");
    expect(note).toHaveTextContent("until the system reconciles it");
    expect(note).toHaveTextContent("The payment amount exceeds the available balance.");
    expect(note).toHaveTextContent("Wait a few minutes and try again.");
  });

  it("the reserved-amount note matches what the API then says: a retry for the full balance gets the 422 on the amount field", async () => {
    const user = userEvent.setup();
    openReturn("/payments/cancel", {
      [PAY_ROUTE]: {
        status: 422,
        body: {
          code: "AMOUNT_EXCEEDS_BALANCE",
          detail: "The payment amount exceeds the available balance.",
        },
      },
    });
    await loaded();

    await user.click(payButton());

    await waitFor(() => expect(amountField()).toHaveAttribute("aria-invalid", "true"));
    expect(amountField()).toHaveAccessibleDescription(
      "The payment amount exceeds the available balance.",
    );
  });

  it("on the success address with nothing remembered or named, says to check Billing & Payments before paying again", async () => {
    open("/payments/success");

    await loaded();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Check Billing & Payments before paying again.",
    );
    expect(paymentPosts()).toHaveLength(0);
  });

  it("a signed-out visitor at the return address is sent to sign-in first", async () => {
    mockApi({ [ME_ROUTE]: { status: 401, body: { detail: "Sign in" } } });
    renderApp("/payments/success");

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Make Payment" })).toBeNull());
  });
});

describe("accessibility in every state", () => {
  const main = () => expectNoA11yViolations(screen.getByRole("main"));

  it("the normal form has no violations", async () => {
    openPay();
    await loaded();

    await main();
  });

  it("the form with a validation error has no violations", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: {
        status: 422,
        body: { code: "AMOUNT_EXCEEDS_BALANCE", detail: "Too much." },
      },
    });
    await loaded();
    await user.click(payButton());
    await screen.findByText("Too much.");

    await main();
  });

  it("the processing state has no violations", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: "pending" });
    await loaded();
    await user.click(payButton());
    await screen.findByRole("button", { name: "Processing…" });

    await main();
  });

  it("the redirecting state has no violations", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: { status: 201, body: created } });
    await loaded();
    await user.click(payButton());
    await screen.findByText("Taking you to the secure payment page.");

    await main();
  });

  it("the in-progress state has no violations", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: {
        status: 409,
        headers: { "Retry-After": "30" },
        body: { code: "PAYMENT_IN_PROGRESS" },
      },
    });
    await loaded();
    await user.click(payButton());
    await screen.findByText("Your payment is still processing.");

    await main();
  });

  it("the timeout state has no violations", async () => {
    const user = userEvent.setup();
    openPay({ [PAY_ROUTE]: { status: 504, body: { code: "PAYMENT_GATEWAY_TIMEOUT" } } });
    await loaded();
    await user.click(payButton());
    await screen.findByText("We are confirming your payment. Do not pay again.");

    await main();
  });

  it("the failed state has no violations", async () => {
    const user = userEvent.setup();
    openPay({
      [PAY_ROUTE]: {
        status: 502,
        body: { code: "PAYMENT_GATEWAY_ERROR", reason: "Insufficient Funds" },
      },
    });
    await loaded();
    await user.click(payButton());
    await screen.findByRole("heading", { name: "Payment Failed" });

    await main();
  });

  it("the success state has no violations", async () => {
    openReturn("/payments/success", {
      [PAYMENT_ROUTE]: { status: 200, body: payment() },
    });
    await screen.findByRole("heading", { name: "Payment Successful" });

    await main();
  });

  it("the cancelled return has no violations", async () => {
    openReturn("/payments/cancel");
    await loaded();

    await main();
  });
});
