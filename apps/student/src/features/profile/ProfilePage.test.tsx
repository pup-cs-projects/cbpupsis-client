import { mockApi } from "@cbpupsis/account/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const PROFILE_ROUTE = "GET /student/profile";
const UPDATE_ROUTE = "PATCH /student/profile";
const CONTACTS_ROUTE = "GET /student/profile/emergency-contacts";

const field = (value: string | number | null, editable = false) => ({ value, editable });

function profile(overrides: Record<string, ReturnType<typeof field>> = {}) {
  return {
    studentId: "2021-00456-MN-0",
    avatarUrl: null,
    petitionRoute: "/api/v1/student/petitions/record-correction",
    fields: {
      studentId: field("2021-00456-MN-0"),
      firstName: field("Juan"),
      middleName: field("Santos"),
      lastName: field("Dela Cruz"),
      program: field("BS in Computer Science"),
      enrollmentStatus: field("pending"),
      phone: field("09123456789", true),
      email: field("juan.personal@gmail.com", true),
      permanentAddress: field("123 Mabini St., Sta. Mesa, Manila", true),
      currentAddress: field("Rm. 305, PUP Dormitory, Sta. Mesa", true),
      ...overrides,
    },
    emergencyContacts: [],
  };
}

const contact = {
  id: "c1",
  name: "Maria Dela Cruz",
  relationship: "Mother",
  phone: "09171234567",
  email: "maria@example.com",
  address: "25 Mabini Street, Antipolo City",
  isPrimary: true,
};

function openProfile(routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [PROFILE_ROUTE]: { status: 200, body: profile() },
    [CONTACTS_ROUTE]: { status: 200, body: [contact] },
    ...routes,
  });
  renderApp("/profile");
  return api;
}

afterEach(() => {
  session.signOut();
  vi.unstubAllGlobals();
});

describe("ProfilePage (US-STU-002)", () => {
  it("shows the student's record as the API holds it", async () => {
    openProfile();

    expect(
      await screen.findByRole("heading", { name: "Juan Santos Dela Cruz" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2021-00456-MN-0")).toBeInTheDocument();
    // The admission year is the student number's first four digits.
    expect(screen.getByText("2021")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText(me.email)).toBeInTheDocument();
    expect(screen.getByText("Maria Dela Cruz")).toBeInTheDocument();
  });

  it("sends only the changed field, with the phone in the API's format", async () => {
    const user = userEvent.setup();
    const api = openProfile({
      [UPDATE_ROUTE]: {
        status: 200,
        body: profile({ phone: field("09998887777", true) }),
      },
    });

    await user.click(await screen.findByRole("button", { name: "Edit personal information" }));
    const phone = screen.getByLabelText(/Phone Number/);
    await user.clear(phone);
    await user.type(phone, "0999 888 7777");
    await user.click(screen.getByRole("button", { name: "Save changes to personal information" }));

    expect(await screen.findByText("Personal information updated successfully.")).toBeVisible();
    expect(api.called(UPDATE_ROUTE)[0]?.body).toEqual({ phone: "09998887777" });
  });

  it("keeps the form open and shows the API's reason when a save is refused", async () => {
    const user = userEvent.setup();
    openProfile({
      [UPDATE_ROUTE]: {
        status: 422,
        body: {
          detail: "Validation failed for email: Expected a valid email address.",
          code: "VALIDATION_ERROR",
        },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Edit personal information" }));
    const email = screen.getByLabelText(/Email Address/);
    await user.clear(email);
    await user.type(email, "juan@new-domain.ph");
    await user.click(screen.getByRole("button", { name: "Save changes to personal information" }));

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("Validation failed for email: Expected a valid email address."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save changes to personal information" }),
    ).toBeInTheDocument();
  });

  it("offers a retry when the profile cannot be loaded", async () => {
    openProfile({ [PROFILE_ROUTE]: "offline" });

    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
