import { mockApi } from "@cbpupsis/account/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { BlockedCourse } from "./BlockedCourse";
import { WaiverForm } from "./WaiverForm";
import {
  blockedSection,
  FILE_ROUTE,
  LIST_ROUTE,
  renderSignedIn,
  SECTION_ID,
  WAIVER_ID,
  waiver,
} from "./waiverFixtures";

afterEach(() => {
  session.signOut();
  vi.unstubAllGlobals();
});

describe("WaiverForm", () => {
  it("AC-ENRL-002.9: files a waiver with the condition and reason, using the keyboard only", async () => {
    const api = mockApi({
      [LIST_ROUTE]: [
        { status: 200, body: [] },
        { status: 200, body: [waiver()] },
      ],
      [FILE_ROUTE]: { status: 202, body: { waiverRequestId: WAIVER_ID, state: "PENDING_CHAIR" } },
    });
    const onWaiverFiled = vi.fn();
    const user = userEvent.setup();
    const { container } = renderSignedIn(
      <BlockedCourse section={blockedSection()} onWaiverFiled={onWaiverFiled} />,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Request a waiver for COMP 009" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Request a waiver for COMP 009" })).toHaveFocus();
    await expectNoA11yViolations(container);

    await user.tab();
    await user.keyboard(" ");
    expect(
      screen.getByRole("radio", { name: "I am repeating the prerequisite subject" }),
    ).toBeChecked();
    await user.tab();
    await user.keyboard("I am retaking COMP 003 this term.");
    await user.tab();
    expect(screen.getByRole("button", { name: "Send waiver request" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText("Waiver filed. It is now with the Chair.")).toBeVisible();
    expect(api.called(FILE_ROUTE)[0]?.body).toEqual({
      sectionId: SECTION_ID,
      prerequisiteCourseCode: "COMP 003",
      condition: "REPEATED_PREREQUISITE",
      justification: "I am retaking COMP 003 this term.",
    });
    expect(onWaiverFiled).toHaveBeenCalledOnce();
    expect(await screen.findByText("With the Chair")).toBeVisible();
  });

  it("AC-ENRL-002.9: asks for a condition and a reason before sending", async () => {
    const api = mockApi({ [FILE_ROUTE]: { status: 202, body: {} } });
    const user = userEvent.setup();
    renderSignedIn(<WaiverForm section={blockedSection()} />);

    await user.click(screen.getByRole("button", { name: "Request a waiver for COMP 009" }));
    await user.click(screen.getByRole("button", { name: "Send waiver request" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose the condition that applies to you.",
    );
    await user.click(screen.getByRole("radio", { name: "My GWA is 1.75 or better" }));
    await user.click(screen.getByRole("button", { name: "Send waiver request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Write your reason for the waiver.");
    expect(api.called(FILE_ROUTE)).toHaveLength(0);
  });

  it("AC-ENRL-002.9: lets the student pick which prerequisite when more than one is unmet", async () => {
    const api = mockApi({
      [FILE_ROUTE]: { status: 202, body: { waiverRequestId: WAIVER_ID, state: "PENDING_CHAIR" } },
    });
    const user = userEvent.setup();
    const section = blockedSection({
      blocks: [
        { rule: "ENROLL_PREREQUISITE_NOT_MET", courseCode: "COMP 003", blockingMark: "Inc" },
        { rule: "ENROLL_PREREQUISITE_NOT_MET", courseCode: "MATH 101", blockingMark: "5.00" },
      ],
    });
    renderSignedIn(<WaiverForm section={section} />);

    await user.click(screen.getByRole("button", { name: "Request a waiver for COMP 009" }));
    await user.selectOptions(screen.getByLabelText("Prerequisite to waive"), "MATH 101");
    await user.click(screen.getByRole("radio", { name: "I am graduating this term" }));
    await user.type(screen.getByLabelText("Reason"), "Last term before graduation.");
    await user.click(screen.getByRole("button", { name: "Send waiver request" }));

    await screen.findByText("Waiver filed. It is now with the Chair.");
    expect(api.called(FILE_ROUTE)[0]?.body).toMatchObject({
      prerequisiteCourseCode: "MATH 101",
      condition: "GRADUATING",
    });
  });

  it("AC-ENRL-002.7: shows the API refusal in words when a waiver is already pending", async () => {
    mockApi({
      [FILE_ROUTE]: {
        status: 409,
        body: {
          status: 409,
          code: "ENROLL_WAIVER_PENDING",
          detail: "A live waiver already exists.",
        },
      },
    });
    const user = userEvent.setup();
    renderSignedIn(<WaiverForm section={blockedSection()} />);

    await user.click(screen.getByRole("button", { name: "Request a waiver for COMP 009" }));
    await user.click(
      screen.getByRole("radio", { name: "I am repeating the prerequisite subject" }),
    );
    await user.type(screen.getByLabelText("Reason"), "Retaking it.");
    await user.click(screen.getByRole("button", { name: "Send waiver request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your waiver for this course is still being reviewed.",
    );
  });

  it("AC-ENRL-002.9: offers no form when waiverAvailable is false", () => {
    mockApi({});
    const { container } = renderSignedIn(
      <WaiverForm section={blockedSection({ waiverAvailable: false })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("AC-ENRL-002.9: Cancel closes the form and returns focus to the button", async () => {
    mockApi({});
    const user = userEvent.setup();
    renderSignedIn(<WaiverForm section={blockedSection()} />);

    await user.click(screen.getByRole("button", { name: "Request a waiver for COMP 009" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Request a waiver for COMP 009" })).toHaveFocus();
  });
});
