import { mockApi } from "@cbpupsis/account/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@cbpupsis/shared/api";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { BlockedCourse } from "./BlockedCourse";
import { refusalMessage } from "./blocking";
import { blockedSection, LIST_ROUTE, renderSignedIn, waiver } from "./waiverFixtures";

afterEach(() => {
  session.signOut();
  vi.unstubAllGlobals();
});

const gate = {
  rule: "ENROLL_THIRD_YEAR_GATE",
  courseCode: "COMP 020",
  details: { peCompleted: 2, peRequired: 4, nstpCompleted: "3", nstpRequired: 6 },
};

describe("BlockedCourse", () => {
  it("AC-ENRL-002.1: shows the lock and the block reason as text a screen reader reads", async () => {
    mockApi({ [LIST_ROUTE]: { status: 200, body: [] } });
    const { container } = renderSignedIn(<BlockedCourse section={blockedSection()} />);

    expect(screen.getByText("COMP 003: Inc; required range 1.00-3.00.")).toBeVisible();
    expect(screen.getByText("Blocked:")).toHaveClass("sr-only");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    await screen.findByText("You have not filed a waiver for this course.");
    await expectNoA11yViolations(container);
  });

  it("AC-ENRL-002.2: says the prerequisite and the mark that unlocks it", () => {
    mockApi({ [LIST_ROUTE]: { status: 200, body: [] } });
    renderSignedIn(<BlockedCourse section={blockedSection()} />);

    expect(screen.getByText("What unlocks it")).toBeVisible();
    expect(
      screen.getByText("Pass COMP 003 with a mark from 1.00 to 3.00. Your mark: Inc."),
    ).toBeVisible();
  });

  it("AC-ENRL-002.3: names a 5.00, W, or in-progress mark the same way", () => {
    mockApi({ [LIST_ROUTE]: { status: 200, body: [] } });
    const section = blockedSection({
      blocks: [
        { rule: "ENROLL_PREREQUISITE_NOT_MET", courseCode: "MATH 101", blockingMark: "5.00" },
        {
          rule: "ENROLL_PREREQUISITE_NOT_MET",
          courseCode: "COMP 001",
          blockingMark: "in progress",
        },
      ],
    });
    renderSignedIn(<BlockedCourse section={section} />);

    expect(screen.getByText(/Pass MATH 101 .* Your mark: 5\.00\./)).toBeVisible();
    expect(screen.getByText(/Pass COMP 001 .* Your mark: in progress\./)).toBeVisible();
  });

  it("AC-ENRL-002.4: shows the third year gate with the PE and NSTP counts done", () => {
    mockApi({ [LIST_ROUTE]: { status: 200, body: [] } });
    const section = blockedSection({
      prerequisitesSatisfied: true,
      blockReason: "COMP 020: complete PE 1-4 (2/4) and NSTP (3/6 units).",
      blocks: [gate],
      waiverAvailable: false,
    });
    renderSignedIn(<BlockedCourse section={section} />);

    expect(
      screen.getByText(
        "Finish PE 1 to 4 and 6 NSTP units before third year courses. Done so far: 2 of 4 PE courses and 3 of 6 NSTP units.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /Request a waiver/ })).not.toBeInTheDocument();
  });

  it("AC-ENRL-002.5: renders nothing for a section that is not blocked", () => {
    mockApi({});
    const { container } = renderSignedIn(
      <BlockedCourse
        section={{
          ...blockedSection(),
          prerequisitesSatisfied: true,
          blocks: [],
          blockReason: null,
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("AC-ENRL-002.6: says one PE course per regular term", () => {
    mockApi({ [LIST_ROUTE]: { status: 200, body: [] } });
    const section = blockedSection({
      prerequisitesSatisfied: true,
      blocks: [{ rule: "ENROLL_PE_SEQUENCE", courseCode: "PATHFIT 2" }],
      waiverAvailable: false,
    });
    renderSignedIn(<BlockedCourse section={section} />);

    expect(screen.getByText("You can take one PE course per regular term.")).toBeVisible();
  });

  it("AC-ENRL-002.7: says a pending waiver is still being reviewed and shows its step", async () => {
    mockApi({ [LIST_ROUTE]: { status: 200, body: [waiver({ state: "PENDING_DEAN" })] } });
    const section = blockedSection({
      blocks: [{ rule: "ENROLL_WAIVER_PENDING", courseCode: "COMP 003", blockingMark: "Inc" }],
      waiverAvailable: false,
    });
    renderSignedIn(<BlockedCourse section={section} />);

    expect(screen.getByText(/Your waiver for this course is still being reviewed\./)).toBeVisible();
    expect(await screen.findByText("With the Dean")).toBeVisible();
  });

  it("AC-ENRL-002.8: shows each waiver step, and remarks when rejected", async () => {
    mockApi({
      [LIST_ROUTE]: {
        status: 200,
        body: [
          waiver({
            state: "PENDING_VPAA",
            waiverRequestId: "20000000-0000-4000-8000-000000000002",
          }),
          waiver({ state: "REJECTED", reviewRemarks: "GWA is below 1.75." }),
        ],
      },
    });
    const { container } = renderSignedIn(<BlockedCourse section={blockedSection()} />);

    expect(await screen.findByText("With the VPAA (recorded by the Registrar)")).toBeVisible();
    expect(screen.getByText("Rejected")).toBeVisible();
    expect(screen.getByText("Remarks: GWA is below 1.75.")).toBeVisible();
    await expectNoA11yViolations(container);
  });

  it("AC-ENRL-002.8: shows Approved and With the Chair", async () => {
    mockApi({
      [LIST_ROUTE]: {
        status: 200,
        body: [
          waiver({ state: "APPROVED" }),
          waiver({
            state: "PENDING_CHAIR",
            waiverRequestId: "20000000-0000-4000-8000-000000000003",
          }),
        ],
      },
    });
    renderSignedIn(<BlockedCourse section={blockedSection()} />);

    expect(await screen.findByText("Approved")).toBeVisible();
    expect(screen.getByText("With the Chair")).toBeVisible();
  });

  it("AC-ENRL-002.8: shows loading, then an error with a retry that works", async () => {
    mockApi({
      [LIST_ROUTE]: ["offline", { status: 200, body: [waiver({ state: "PENDING_CHAIR" })] }],
    });
    renderSignedIn(<BlockedCourse section={blockedSection()} />);

    expect(screen.getByText("Loading your waivers...")).toBeVisible();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("With the Chair")).toBeVisible();
  });
});

describe("refusalMessage (409 on submit)", () => {
  const refused = (code: string) =>
    new ApiError(409, code as never, { detail: "The API's own words." });

  it("AC-ENRL-002.2: ENROLL_PREREQUISITE_NOT_MET names the prerequisite and the blocking mark", () => {
    expect(refusalMessage(refused("ENROLL_PREREQUISITE_NOT_MET"), blockedSection().blocks)).toBe(
      "You have not passed the prerequisite COMP 003: your mark is Inc. You need 1.00 to 3.00.",
    );
  });

  it("AC-ENRL-002.3: without the section's blocks it falls back to the API's words", () => {
    expect(refusalMessage(refused("ENROLL_PREREQUISITE_NOT_MET"))).toBe("The API's own words.");
  });

  it("AC-ENRL-002.4: ENROLL_THIRD_YEAR_GATE gives the counts done", () => {
    expect(refusalMessage(refused("ENROLL_THIRD_YEAR_GATE"), [gate])).toBe(
      "Finish PE 1 to 4 and 6 NSTP units before third year courses. Done so far: 2 of 4 PE courses and 3 of 6 NSTP units.",
    );
  });

  it("AC-ENRL-002.6: ENROLL_PE_SEQUENCE says one PE course per regular term", () => {
    expect(refusalMessage(refused("ENROLL_PE_SEQUENCE"))).toBe(
      "You can take one PE course per regular term.",
    );
  });

  it("AC-ENRL-002.7: ENROLL_WAIVER_PENDING says the waiver is still being reviewed", () => {
    expect(refusalMessage(refused("ENROLL_WAIVER_PENDING"))).toBe(
      "Your waiver for this course is still being reviewed.",
    );
  });
});
