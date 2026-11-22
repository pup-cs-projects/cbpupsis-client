import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const TERM = "30000000-0000-4000-8000-000000000001";
const FEES = `/admin/fee-structures/${TERM}`;
const OLD_TERM = "30000000-0000-4000-8000-000000000002";
const OPTIONS_ROUTE = "GET /admin/fee-structures/options";
const PROGRAM = "50000000-0000-4000-8000-000000000001";
const PROGRAM_IT = "50000000-0000-4000-8000-000000000002";
const IN_USE = "Students were already assessed with these fees. Set up the change for a new term.";
const NOT_AVAILABLE = "This page is not available to your role.";

const saved = {
  academicTermId: TERM,
  tuitionPerUnit: "500.00",
  programTuitionRates: [{ programId: PROGRAM, tuitionPerUnit: "550.00" }],
  registrationFee: "1250.00",
  labFee: "3500.00",
  miscFee: "800.00",
  lateFeeRate: "3.50",
  dueDate: "2026-08-15",
  subsidyCoveredFees: ["TUITION", "LAB"],
  installments: [
    { installmentNumber: 1, percentage: "40.00", dueDate: "2026-09-15" },
    { installmentNumber: 2, percentage: "30.00", dueDate: "2026-10-15" },
    { installmentNumber: 3, percentage: "30.00", dueDate: "2026-11-15" },
  ],
};

const blank = {
  academicTermId: TERM,
  tuitionPerUnit: "0.00",
  programTuitionRates: [],
  registrationFee: "0.00",
  labFee: "0.00",
  miscFee: "0.00",
  lateFeeRate: "0.00",
  dueDate: null,
  subsidyCoveredFees: [],
  installments: [],
};

const options = {
  terms: [
    {
      id: TERM,
      academicYear: "2026-2027",
      semester: "FIRST_SEMESTER",
      isCurrent: true,
      hasFeeStructure: true,
    },
    {
      id: OLD_TERM,
      academicYear: "2025-2026",
      semester: "SECOND_SEMESTER",
      isCurrent: false,
      hasFeeStructure: false,
    },
  ],
  programs: [
    { id: PROGRAM, code: "BSCS", name: "Bachelor of Science in Computer Science" },
    { id: PROGRAM_IT, code: "BSIT", name: "Bachelor of Science in Information Technology" },
  ],
};

/** The same options with no current term, so nothing loads until Finance picks one. */
const noCurrent = {
  ...options,
  terms: options.terms.map((term) => ({ ...term, isCurrent: false })),
};

type Routes = Parameters<typeof mockApi>[0];

beforeEach(() => {
  // axe-core asks for a canvas context, which jsdom does not implement.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(async () => {
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Open /fee-structures through the real router as an admin holding `position`. */
function openPage(position: string, routes: Routes = {}) {
  signInDirectly();
  const http = mockApi({
    "GET /admin/me": { status: 200, body: { ...me, position } },
    "GET /users/me": { status: 200, body: { full_name: "Admin User", email: me.email } },
    "POST /auth/admin/logout": { status: 204 },
    [OPTIONS_ROUTE]: { status: 200, body: options },
    ...routes,
  });
  renderApp("/fee-structures");
  return { ...http, user: userEvent.setup() };
}

/** Finance picks the term from the dropdown and its fees load. */
async function loadTerm(routes: Routes) {
  const view = openPage("finance", {
    [OPTIONS_ROUTE]: { status: 200, body: noCurrent },
    ...routes,
  });
  await view.user.selectOptions(await screen.findByLabelText(/^Term/), TERM);
  return view;
}

function errorOf(field: HTMLElement) {
  const ids = field.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

describe("Fee structure page (US-FIN-003)", () => {
  it.each([
    ["Finance", "finance"],
    ["Registrar", "registrar"],
    ["Dean", "dean"],
    ["Chair", "chairperson"],
  ])(
    "AC-FIN-003.8: renders for %s with the nav and page that role may use",
    async (_, position) => {
      const { user, called } = openPage(position, {
        [`GET ${FEES}`]: { status: 200, body: saved },
      });
      await screen.findByRole("heading", { name: "Fee structure", level: 1 });
      if (position === "finance") {
        await user.click(await screen.findByRole("button", { name: "Financial" }));
        expect(screen.getByRole("link", { name: "Fee structure" })).toHaveAttribute(
          "href",
          "/fee-structures",
        );
        expect(await screen.findByLabelText(/^Term/)).toBeInTheDocument();
        expect(screen.queryByText(NOT_AVAILABLE)).not.toBeInTheDocument();
        return;
      }
      await screen.findByText(NOT_AVAILABLE);
      expect(screen.queryByRole("button", { name: "Financial" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Fee structure" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^Term/)).not.toBeInTheDocument();
      expect(called(`GET ${FEES}`)).toHaveLength(0);
      expect(called(OPTIONS_ROUTE)).toHaveLength(0);
    },
  );

  it("AC-FIN-003.8: shows the role message when the API answers 403", async () => {
    await loadTerm({
      [`GET ${FEES}`]: {
        status: 403,
        body: { detail: "Insufficient role.", code: "AUTH_INSUFFICIENT_ROLE" },
      },
    });
    await screen.findByText(NOT_AVAILABLE);
    expect(screen.queryByRole("form", { name: "Fee structure" })).not.toBeInTheDocument();
  });

  it("AC-FIN-003.1: loads every group for the chosen term and saves it with PUT", async () => {
    const { user, called } = await loadTerm({
      [`GET ${FEES}`]: { status: 200, body: saved },
      [`PUT ${FEES}`]: { status: 200, body: saved },
    });
    for (const name of [
      "Tuition per program",
      "Fixed fees",
      "Free tuition coverage",
      "Due date and late penalty",
      "Installments",
    ]) {
      expect(await screen.findByRole("heading", { name, level: 2 })).toBeInTheDocument();
    }
    expect(screen.getByLabelText(/Default tuition per unit/)).toHaveValue("500.00");
    const programRates = screen.getByRole("list", { name: "Program tuition rates" });
    expect(within(programRates).getByText("BSCS")).toBeInTheDocument();
    expect(
      within(programRates).getByText("Bachelor of Science in Computer Science"),
    ).toBeInTheDocument();
    expect(programRates).not.toHaveTextContent(PROGRAM);
    expect(screen.getByLabelText(/BSCS tuition per unit/)).toHaveValue("550.00");
    expect(screen.getByLabelText(/Registration fee \(PHP\)/)).toHaveValue("1250.00");
    expect(screen.getByLabelText(/Late penalty rate/)).toHaveValue("3.50");
    expect(screen.getByLabelText("Payment due date")).toHaveValue("2026-08-15");

    await user.clear(screen.getByLabelText(/Laboratory fee \(PHP\)/));
    await user.type(screen.getByLabelText(/Laboratory fee \(PHP\)/), "3600.00");
    await user.click(screen.getByRole("button", { name: "Save fee structure" }));
    await screen.findByText("Fee structure saved for this term.");
    const sent = called(`PUT ${FEES}`)[0]?.body;
    expect(sent).toEqual({ ...saved, academicTermId: undefined, labFee: "3600.00" });
    expect(sent).not.toHaveProperty("academicTermId");
  });

  it("AC-FIN-003.3: shows a live installment total and how far it is from 100 percent", async () => {
    const { user } = await loadTerm({ [`GET ${FEES}`]: { status: 200, body: saved } });
    expect(await screen.findByText(/Total: 100\.00%/)).toBeInTheDocument();
    const third = screen.getByLabelText(/Installment 3 share/);
    await user.clear(third);
    await user.type(third, "29.5");
    expect(screen.getByText("Total: 99.50%. 0.50% short of 100%.")).toBeInTheDocument();
    await user.clear(third);
    await user.type(third, "30.5");
    expect(screen.getByText("Total: 100.50%. 0.50% over 100%.")).toBeInTheDocument();
  });

  it("AC-FIN-003.4: disables Save until the installments total exactly 100", async () => {
    const { user, called } = await loadTerm({
      [`GET ${FEES}`]: { status: 200, body: saved },
      [`PUT ${FEES}`]: { status: 200, body: saved },
    });
    const third = await screen.findByLabelText(/Installment 3 share/);
    await user.clear(third);
    await user.type(third, "29.5");
    const save = screen.getByRole("button", { name: "Save fee structure" });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(
      "Save is available once the installments total exactly 100%.",
    );
    await user.clear(third);
    await user.type(third, "30");
    expect(save).toBeEnabled();
    await user.click(save);
    await screen.findByText("Fee structure saved for this term.");
    expect(called(`PUT ${FEES}`)).toHaveLength(1);
  });

  it("AC-FIN-003.6: gives each fee a free tuition checkbox and saves the marked fees", async () => {
    const { user, called } = await loadTerm({
      [`GET ${FEES}`]: { status: 200, body: saved },
      [`PUT ${FEES}`]: { status: 200, body: saved },
    });
    const boxes = await screen.findAllByRole("checkbox", { name: /Covered by free tuition/ });
    expect(boxes).toHaveLength(4);
    expect(screen.getByRole("checkbox", { name: /Tuition\)/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Laboratory fee\)/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Registration fee\)/ })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /Registration fee\)/ }));
    await user.click(screen.getByRole("checkbox", { name: /Laboratory fee\)/ }));
    expect(
      screen.getByText("Free tuition (RA 10931) covers: Tuition, Registration fee."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save fee structure" }));
    await screen.findByText("Fee structure saved for this term.");
    const body = called(`PUT ${FEES}`)[0]?.body as { subsidyCoveredFees: string[] };
    expect([...body.subsidyCoveredFees].sort()).toEqual(["REGISTRATION", "TUITION"]);
  });

  it("AC-FIN-003.2: shows a 422 VALIDATION_ERROR next to the field it names", async () => {
    const { user } = await loadTerm({
      [`GET ${FEES}`]: { status: 200, body: saved },
      [`PUT ${FEES}`]: {
        status: 422,
        body: {
          detail: "Rate or fee 'lab_fee' must not be negative.",
          code: "VALIDATION_ERROR",
          field: "lab_fee",
          details: { field: "lab_fee" },
        },
      },
    });
    await user.click(await screen.findByRole("button", { name: "Save fee structure" }));
    const lab = screen.getByLabelText(/Laboratory fee \(PHP\)/);
    await waitFor(() => expect(lab).toHaveAttribute("aria-invalid", "true"));
    expect(errorOf(lab)).toContain("Rate or fee 'lab_fee' must not be negative.");
    expect(errorOf(screen.getByLabelText(/Registration fee \(PHP\)/))).toBe("");
  });

  it("AC-FIN-003.2: refuses a negative fee before sending it", async () => {
    const { user, called } = await loadTerm({ [`GET ${FEES}`]: { status: 200, body: saved } });
    const misc = await screen.findByLabelText(/Miscellaneous fee \(PHP\)/);
    await user.clear(misc);
    await user.type(misc, "-1");
    await user.click(screen.getByRole("button", { name: "Save fee structure" }));
    expect(misc).toHaveAttribute("aria-invalid", "true");
    expect(errorOf(misc)).toContain("Enter 0 or more, with up to two decimals.");
    expect(called(`PUT ${FEES}`)).toHaveLength(0);
  });

  it("AC-FIN-003.3: shows a 422 INSTALLMENT_SUM_INVALID next to the installment total", async () => {
    const { user } = await loadTerm({
      [`GET ${FEES}`]: { status: 200, body: saved },
      [`PUT ${FEES}`]: {
        status: 422,
        body: {
          detail: "Installment percentages must sum to exactly 100 (received 99.50).",
          code: "INSTALLMENT_SUM_INVALID",
          details: { sum: "99.50" },
        },
      },
    });
    await user.click(await screen.findByRole("button", { name: "Save fee structure" }));
    const message = await screen.findByText(/must sum to exactly 100/);
    expect(message.previousElementSibling).toHaveTextContent(/^Total:/);
  });

  it("AC-FIN-003.5: shows a 422 INSTALLMENT_DATE_ORDER next to the pair it names", async () => {
    const { user } = await loadTerm({
      [`GET ${FEES}`]: { status: 200, body: saved },
      [`PUT ${FEES}`]: {
        status: 422,
        body: {
          detail: "Installment due date 2026-02-01 is earlier than preceding due date 2026-03-01.",
          code: "INSTALLMENT_DATE_ORDER",
          details: { previousDate: "2026-03-01", currentDate: "2026-02-01" },
        },
      },
    });
    const first = await screen.findByLabelText(/Installment 1 due date/);
    const second = screen.getByLabelText(/Installment 2 due date/);
    await user.clear(first);
    await user.type(first, "2026-03-01");
    await user.clear(second);
    await user.type(second, "2026-02-01");
    await user.click(screen.getByRole("button", { name: "Save fee structure" }));
    await waitFor(() => expect(second).toHaveAttribute("aria-invalid", "true"));
    expect(errorOf(second)).toBe(
      "Installment 2 is due 2026-02-01, before installment 1 on 2026-03-01. Put the due dates in order.",
    );
    expect(first).not.toHaveAttribute("aria-invalid");
  });

  it("AC-FIN-003.7: explains a 409 FEE_STRUCTURE_IN_USE and stops further saves", async () => {
    const { user, called } = await loadTerm({
      [`GET ${FEES}`]: { status: 200, body: saved },
      [`PUT ${FEES}`]: {
        status: 409,
        body: { detail: "The fee structure cannot be modified.", code: "FEE_STRUCTURE_IN_USE" },
      },
    });
    await user.click(await screen.findByRole("button", { name: "Save fee structure" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(IN_USE);
    expect(screen.getByRole("button", { name: "Save fee structure" })).toBeDisabled();
    expect(screen.getByLabelText(/Laboratory fee \(PHP\)/)).toBeDisabled();
    expect(called(`PUT ${FEES}`)).toHaveLength(1);
  });

  it("asks for a term first, then shows a loading message", async () => {
    const { user } = openPage("finance", {
      [OPTIONS_ROUTE]: { status: 200, body: noCurrent },
      [`GET ${FEES}`]: "pending",
    });
    expect(
      await screen.findByText("Choose a term to see and edit its fee structure."),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/^Term/), TERM);
    expect(await screen.findByText("Loading the fee structure…")).toBeInTheDocument();
  });

  it("shows an error with a retry, then the empty message for an unsaved term", async () => {
    const { user } = await loadTerm({
      [`GET ${FEES}`]: [
        { status: 503, body: { detail: "Service unavailable.", request_id: "req-9" } },
        { status: 200, body: blank },
      ],
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Service unavailable.");
    expect(alert).toHaveTextContent("Request ID: req-9");
    await user.click(within(alert).getByRole("button", { name: "Retry loading fees" }));
    expect(
      await screen.findByText("No fees are saved for this term yet. Enter them below, then save."),
    ).toBeInTheDocument();
  });

  it("asks for a term before calling the API when no term is current", async () => {
    const { called } = openPage("finance", { [OPTIONS_ROUTE]: { status: 200, body: noCurrent } });
    const term = await screen.findByLabelText(/^Term/);
    expect(term).toHaveValue("");
    expect(
      screen.getByText("Choose a term to see and edit its fee structure."),
    ).toBeInTheDocument();
    expect(called(`GET ${FEES}`)).toHaveLength(0);
  });

  it("shows a loading message while the terms and programs load", async () => {
    openPage("finance", { [OPTIONS_ROUTE]: "pending" });
    expect(await screen.findByText("Loading terms and programs…")).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Term/)).not.toBeInTheDocument();
  });

  it("shows an error with a retry when the terms and programs fail to load", async () => {
    const { user, called } = openPage("finance", {
      [OPTIONS_ROUTE]: [
        { status: 503, body: { detail: "Service unavailable.", request_id: "req-7" } },
        { status: 200, body: options },
      ],
      [`GET ${FEES}`]: { status: 200, body: saved },
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Service unavailable.");
    expect(alert).toHaveTextContent("Request ID: req-7");
    expect(called(`GET ${FEES}`)).toHaveLength(0);
    await user.click(within(alert).getByRole("button", { name: "Retry loading terms" }));
    expect(await screen.findByLabelText(/^Term/)).toHaveValue(TERM);
    expect(called(OPTIONS_ROUTE)).toHaveLength(2);
  });

  it("preselects the current term, names it, and loads its fees", async () => {
    const { called } = openPage("finance", { [`GET ${FEES}`]: { status: 200, body: saved } });
    const term = await screen.findByLabelText(/^Term/);
    expect(term).toHaveValue(TERM);
    expect(
      screen.getByRole("option", { name: "2026-2027 First semester (current)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "2025-2026 Second semester, no fees saved" }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText(/Default tuition per unit/)).toHaveValue("500.00");
    expect(called(`GET ${FEES}`)).toHaveLength(1);
  });

  it("adds a program rate from the programs not yet listed", async () => {
    const { user, called } = await loadTerm({
      [`GET ${FEES}`]: { status: 200, body: saved },
      [`PUT ${FEES}`]: { status: 200, body: saved },
    });
    const pick = await screen.findByLabelText("Program to add");
    const choices = within(pick)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(choices).toEqual([
      "Choose a program",
      "BSIT: Bachelor of Science in Information Technology",
    ]);
    const add = screen.getByRole("button", { name: "Add program rate" });
    expect(add).toBeDisabled();
    await user.selectOptions(pick, PROGRAM_IT);
    await user.click(add);
    await user.type(screen.getByLabelText(/BSIT tuition per unit/), "600.00");
    expect(screen.queryByLabelText("Program to add")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save fee structure" }));
    await screen.findByText("Fee structure saved for this term.");
    const body = called(`PUT ${FEES}`)[0]?.body as { programTuitionRates: unknown[] };
    expect(body.programTuitionRates).toEqual([
      { programId: PROGRAM, tuitionPerUnit: "550.00" },
      { programId: PROGRAM_IT, tuitionPerUnit: "600.00" },
    ]);
  });

  it("passes the axe check with the form loaded", async () => {
    await loadTerm({ [`GET ${FEES}`]: { status: 200, body: saved } });
    await screen.findByRole("heading", { name: "Installments", level: 2 });
    const results = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
