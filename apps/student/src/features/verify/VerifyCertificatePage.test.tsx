import { mockApi } from "@cbpupsis/account/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../../test/axe";
import { renderApp } from "../../test/renderApp";

const VERIFY_ROUTE = "GET /public/cor/verify/tok-1";

const verified = (status: "CURRENT" | "SUPERSEDED") => ({
  status: 200,
  body: {
    name: "Juan Dela Cruz",
    studentNumber: "2021-00123-MN-0",
    term: { year: "2026-2027", semester: "first" },
    issuedAt: "2026-06-02T01:00:00Z",
    status,
  },
});

function openVerify(reply: Parameters<typeof mockApi>[0][string]) {
  // No sign-in: the page is public.
  const api = mockApi({ [VERIFY_ROUTE]: reply });
  renderApp("/verify/tok-1");
  return api;
}

/** The dd beside a dt with this label. */
function value(label: string) {
  return screen.getByText(label).nextElementSibling;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VerifyCertificatePage (US-ENRL-003)", () => {
  it("AC-ENRL-003.4: a found token shows name, student number, term, issue date, and Current, without signing in", async () => {
    const api = openVerify(verified("CURRENT"));

    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(value("Student number")).toHaveTextContent("2021-00123-MN-0");
    expect(value("Term")).toHaveTextContent("2026-2027, First Semester");
    expect(value("Date issued")).toHaveTextContent("June 2, 2026");
    expect(value("Status")).toHaveTextContent("Current");
    expect(api.called(VERIFY_ROUTE)[0]?.authorization).toBeNull();
  });

  it("AC-ENRL-003.8: a superseded certificate reads 'Replaced by a newer certificate'", async () => {
    openVerify(verified("SUPERSEDED"));

    expect(await screen.findByText("Replaced by a newer certificate")).toBeInTheDocument();
  });

  it("AC-ENRL-003.4: a 404 says no certificate matches this code", async () => {
    openVerify({ status: 404, body: { code: "RESOURCE_NOT_FOUND" } });

    expect(await screen.findByText("No certificate matches this code.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("AC-ENRL-003.4: a 429 asks the visitor to try again in a minute, and retry works", async () => {
    const user = userEvent.setup();
    openVerify([{ status: 429, body: { code: "rate_limited" } }, verified("CURRENT")]);

    expect(await screen.findByText("Too many checks. Try again in a minute.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument();
  });

  it("AC-ENRL-003.4: shows a loading message while checking", async () => {
    openVerify("pending");

    expect(await screen.findByText("Checking the certificate")).toBeInTheDocument();
  });

  it("AC-ENRL-003.4: passes the axe check with no violations", async () => {
    openVerify(verified("CURRENT"));

    await screen.findByText("Juan Dela Cruz");
    await expectNoA11yViolations(document.body);
  });
});
