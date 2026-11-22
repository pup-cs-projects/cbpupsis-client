import { mockApi } from "@cbpupsis/account/testing";
import { cleanup, configure, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";
import { AVATAR_PLACEHOLDER } from "./useAvatar";

const DASHBOARD_ROUTE = "GET /student/dashboard";

// Each test renders the whole app and loads real PSGC data, so give async work room on a slow run.
configure({ asyncUtilTimeout: 4000 });
vi.setConfig({ testTimeout: 20_000 });

const PROFILE_ROUTE = "GET /student/profile";
const UPDATE_ROUTE = "PATCH /student/profile";
const CONTACTS_ROUTE = "GET /student/profile/emergency-contacts";
const CREATE_CONTACT_ROUTE = "POST /student/profile/emergency-contacts";
const contactRoute = (method: string, id: string) =>
  `${method} /student/profile/emergency-contacts/${id}`;

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
      emailAddress: field("juan.personal@gmail.com", true),
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
const brother = {
  id: "c2",
  name: "Pedro Dela Cruz",
  relationship: "Brother",
  phone: "09181234567",
  email: "pedro@example.com",
  address: null,
  isPrimary: false,
};
const aunt = {
  id: "c3",
  name: "Ana Santos",
  relationship: "Aunt",
  phone: "09191234567",
  email: "ana@example.com",
  address: null,
  isPrimary: false,
};

const OLD_FIELD_NAMES = ["mailingAddress", "personalEmail", "phoneNumber"];

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

// jsdom has no <dialog> behavior; this is enough for showModal() to make one visible.
const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal"),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close"),
};

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });
});

afterEach(() => {
  // Unmount first: closing an open dialog on the way out needs the polyfill below.
  cleanup();
  for (const name of ["showModal", "close"] as const) {
    const original = dialogMethods[name];
    if (original) Object.defineProperty(HTMLDialogElement.prototype, name, original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  session.signOut();
  vi.unstubAllGlobals();
});

interface Place {
  region: string;
  province?: string;
  city: string;
  barangay: string;
  street: string;
}

/** Fills one PSGC picker the way a student does: top to bottom, one dropdown at a time. */
async function pickAddress(user: UserEvent, group: HTMLElement, place: Place) {
  const inGroup = within(group);
  await user.selectOptions(inGroup.getByLabelText("Region"), place.region);
  if (place.province) {
    const province = inGroup.getByLabelText("Province");
    await waitFor(() => expect(province).toBeEnabled());
    await user.selectOptions(province, place.province);
  }
  const city = inGroup.getByLabelText("City / Municipality");
  await waitFor(() => expect(city).toBeEnabled());
  await user.selectOptions(city, place.city);
  await user.selectOptions(inGroup.getByLabelText("Barangay"), place.barangay);
  await user.type(inGroup.getByLabelText("House No. & Street"), place.street);
}

const permanentGroup = () => screen.getByRole("group", { name: "Home Address (Permanent)" });
const currentGroup = () => screen.getByRole("group", { name: "Current Residence Address" });

async function startEditingProfile(user: UserEvent) {
  await user.click(await screen.findByRole("button", { name: "Edit personal information" }));
}

async function startManagingContacts(user: UserEvent) {
  await user.click(await screen.findByRole("button", { name: "Edit emergency contacts" }));
}

function save() {
  return screen.getByRole("button", { name: "Save changes to personal information" });
}

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
    // The personal email comes from the API's `emailAddress` field.
    expect(screen.getByLabelText(/Email Address/)).toHaveValue("juan.personal@gmail.com");
  });

  it("sends only the changed field, with the phone in the API's format", async () => {
    const user = userEvent.setup();
    const api = openProfile({
      [UPDATE_ROUTE]: {
        status: 200,
        body: profile({ phone: field("09998887777", true) }),
      },
    });

    await startEditingProfile(user);
    const phone = screen.getByLabelText(/Phone Number/);
    await user.clear(phone);
    await user.type(phone, "0999 888 7777");
    await user.click(save());

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

    await startEditingProfile(user);
    const email = screen.getByLabelText(/Email Address/);
    await user.clear(email);
    await user.type(email, "juan@new-domain.ph");
    await user.click(save());

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("Validation failed for email: Expected a valid email address."),
    ).toBeInTheDocument();
    expect(save()).toBeInTheDocument();
  });

  it("offers a retry when the profile cannot be loaded", async () => {
    openProfile({ [PROFILE_ROUTE]: "offline" });

    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  describe("AC-STU-002.2: the save request carries only the API's field names", () => {
    it("sends exactly phone, emailAddress, permanentAddress and currentAddress", async () => {
      const user = userEvent.setup();
      const permanent = "12 Rizal Ave., Brgy. 630, Manila, Metro Manila";
      const current = "9 Quezon Ave., Brgy. 630, Manila, Metro Manila";
      const api = openProfile({
        [UPDATE_ROUTE]: {
          status: 200,
          body: profile({
            phone: field("09998887777", true),
            emailAddress: field("juan@new-domain.ph", true),
            permanentAddress: field(permanent, true),
            currentAddress: field(current, true),
          }),
        },
      });

      await startEditingProfile(user);
      const phone = screen.getByLabelText(/Phone Number/);
      await user.clear(phone);
      await user.type(phone, "09998887777");
      const email = screen.getByLabelText(/Email Address/);
      await user.clear(email);
      await user.type(email, "juan@new-domain.ph");
      await user.click(screen.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      await pickAddress(user, permanentGroup(), {
        region: "National Capital Region (NCR)",
        city: "Manila",
        barangay: "Barangay 630",
        street: "12 Rizal Ave.",
      });
      await user.click(screen.getByRole("button", { name: "Edit Current Residence Address" }));
      await pickAddress(user, currentGroup(), {
        region: "National Capital Region (NCR)",
        city: "Manila",
        barangay: "Barangay 630",
        street: "9 Quezon Ave.",
      });
      await user.click(save());

      expect(await screen.findByText("Personal information updated successfully.")).toBeVisible();
      const [request] = api.called(UPDATE_ROUTE);
      expect(Object.keys(request?.body as object).sort()).toEqual([
        "currentAddress",
        "emailAddress",
        "permanentAddress",
        "phone",
      ]);
      expect(request?.body).toEqual({
        phone: "09998887777",
        emailAddress: "juan@new-domain.ph",
        permanentAddress: permanent,
        currentAddress: current,
      });
      const raw = JSON.stringify(request?.body);
      for (const old of OLD_FIELD_NAMES) expect(raw).not.toContain(old);
    });

    it("sends an emergency contact with only name, relationship, phone, email, address and isPrimary", async () => {
      const user = userEvent.setup();
      const api = openProfile({
        [contactRoute("PATCH", "c1")]: { status: 200, body: contact },
      });

      await startManagingContacts(user);
      await user.click(
        await screen.findByRole("button", { name: "Edit emergency contact: Maria Dela Cruz" }),
      );
      const dialog = await screen.findByRole("dialog", { name: "Edit Emergency Contact" });
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Edit Emergency Contact" })).toBeNull(),
      );
      const [request] = api.called(contactRoute("PATCH", "c1"));
      expect(Object.keys(request?.body as object).sort()).toEqual([
        "address",
        "email",
        "isPrimary",
        "name",
        "phone",
        "relationship",
      ]);
      const raw = JSON.stringify(request?.body);
      for (const old of [...OLD_FIELD_NAMES, "fullName", "id"]) expect(raw).not.toContain(old);
    });
  });

  describe("AC-STU-002.4: the API's field errors appear under their fields", () => {
    const refusal = (errors: Record<string, string>) => ({
      status: 422,
      body: {
        detail: "Validation failed.",
        code: "VALIDATION_ERROR",
        details: { fields: Object.keys(errors), errors },
      },
    });

    it("shows a phone error under the phone field and not as a banner", async () => {
      const user = userEvent.setup();
      const reason = "Expected Philippine mobile format (+639XXXXXXXXX or 09XXXXXXXXX).";
      openProfile({ [UPDATE_ROUTE]: refusal({ phone: reason }) });

      await startEditingProfile(user);
      const phone = screen.getByLabelText(/Phone Number/);
      await user.clear(phone);
      await user.type(phone, "09998887777");
      await user.click(save());

      await waitFor(() => expect(phone).toHaveAccessibleDescription(reason));
      expect(phone).toBeInvalid();
      expect(screen.getByLabelText(/Email Address/)).toBeValid();
      expect(screen.getAllByText(reason)).toHaveLength(1);
      expect(screen.queryByText("Personal information was not saved")).toBeNull();
    });

    it("shows address errors under the matching address", async () => {
      const user = userEvent.setup();
      openProfile({
        [UPDATE_ROUTE]: refusal({
          permanentAddress: "Expected a valid mailing address.",
          currentAddress: "Address is too long.",
        }),
      });

      await startEditingProfile(user);
      await user.click(screen.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      await pickAddress(user, permanentGroup(), {
        region: "National Capital Region (NCR)",
        city: "Manila",
        barangay: "Barangay 630",
        street: "12 Rizal Ave.",
      });
      await user.click(save());

      await waitFor(() =>
        expect(permanentGroup()).toHaveAccessibleDescription("Expected a valid mailing address."),
      );
      expect(currentGroup()).toHaveAccessibleDescription("Address is too long.");
    });

    it("shows a contact's field errors under that contact's inputs", async () => {
      const user = userEvent.setup();
      const reason = "Expected Philippine mobile format (+639XXXXXXXXX or 09XXXXXXXXX).";
      openProfile({ [CREATE_CONTACT_ROUTE]: refusal({ phone: reason }) });

      await startManagingContacts(user);
      await user.click(await screen.findByRole("button", { name: "Add Emergency Contact" }));
      const dialog = await screen.findByRole("dialog", { name: "Add Emergency Contact" });
      await user.type(within(dialog).getByLabelText(/Full Name/), "Luis Reyes");
      await user.type(within(dialog).getByLabelText(/Relationship/), "Uncle");
      await user.type(within(dialog).getByLabelText(/Phone Number/), "09201234567");
      await user.type(within(dialog).getByLabelText(/Email Address/), "luis@example.com");
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      const phone = within(dialog).getByLabelText(/Phone Number/);
      await waitFor(() => expect(phone).toHaveAccessibleDescription(reason));
      // The dialog stays open with everything typed, and the button works again.
      expect(within(dialog).getByLabelText(/Full Name/)).toHaveValue("Luis Reyes");
      expect(within(dialog).getByRole("button", { name: "Save contact" })).toBeEnabled();
    });
  });

  describe("AC-STU-002.5: PSGC address picker", () => {
    it("shows an existing address as text until Edit is pressed", async () => {
      const user = userEvent.setup();
      openProfile();

      await startEditingProfile(user);
      const group = within(permanentGroup());
      expect(group.getByText("123 Mabini St., Sta. Mesa, Manila")).toBeInTheDocument();
      expect(group.queryByRole("combobox")).toBeNull();
      expect(group.queryByRole("textbox")).toBeNull();

      await user.click(group.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      expect(group.getByLabelText("Region")).toBeInTheDocument();
      expect(group.getByLabelText("House No. & Street")).toBeInTheDocument();

      await user.click(group.getByRole("button", { name: "Keep current address" }));
      expect(group.getByText("123 Mabini St., Sta. Mesa, Manila")).toBeInTheDocument();
      expect(group.queryByRole("combobox")).toBeNull();
    });

    it("keeps an address nobody touched out of the request", async () => {
      const user = userEvent.setup();
      const api = openProfile({ [UPDATE_ROUTE]: { status: 200, body: profile() } });

      await startEditingProfile(user);
      const phone = screen.getByLabelText(/Phone Number/);
      await user.clear(phone);
      await user.type(phone, "09998887777");
      // Opening the picker and backing out leaves the saved string as it was.
      await user.click(screen.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      await user.click(
        within(permanentGroup()).getByRole("button", { name: "Keep current address" }),
      );
      await user.click(save());

      await waitFor(() => expect(api.called(UPDATE_ROUTE)).toHaveLength(1));
      expect(api.called(UPDATE_ROUTE)[0]?.body).toEqual({ phone: "09998887777" });
    });

    it("refuses to save an address that is only partly chosen", async () => {
      const user = userEvent.setup();
      const api = openProfile();

      await startEditingProfile(user);
      await user.click(screen.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      await user.selectOptions(
        within(permanentGroup()).getByLabelText("Region"),
        "National Capital Region (NCR)",
      );
      await user.click(save());

      expect(
        await within(permanentGroup()).findByText(
          "Choose every part of the address, or keep the current one.",
        ),
      ).toBeInTheDocument();
      expect(api.called(UPDATE_ROUTE)).toHaveLength(0);
    });

    it("skips the province for NCR and saves Metro Manila", async () => {
      const user = userEvent.setup();
      const api = openProfile({ [UPDATE_ROUTE]: { status: 200, body: profile() } });

      await startEditingProfile(user);
      await user.click(screen.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      const group = within(permanentGroup());
      await user.selectOptions(group.getByLabelText("Region"), "National Capital Region (NCR)");

      expect(group.queryByLabelText("Province")).toBeNull();
      const city = group.getByLabelText("City / Municipality");
      await waitFor(() => expect(city).toBeEnabled());
      // NCR's cities list straight under the region, and only NCR's.
      const cityNames = within(city)
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(cityNames).toEqual(expect.arrayContaining(["Manila", "Quezon City", "Taguig"]));
      expect(cityNames).not.toContain("Antipolo");

      await user.selectOptions(city, "Manila");
      await user.selectOptions(group.getByLabelText("Barangay"), "Barangay 630");
      await user.type(group.getByLabelText("House No. & Street"), "123 Mabini St.");
      await user.click(save());

      await waitFor(() => expect(api.called(UPDATE_ROUTE)).toHaveLength(1));
      expect(api.called(UPDATE_ROUTE)[0]?.body).toEqual({
        permanentAddress: "123 Mabini St., Brgy. 630, Manila, Metro Manila",
      });
    });

    it("filters each dropdown by the one above it and saves province and region", async () => {
      const user = userEvent.setup();
      const api = openProfile({ [UPDATE_ROUTE]: { status: 200, body: profile() } });

      await startEditingProfile(user);
      await user.click(screen.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      const group = within(permanentGroup());
      // Nothing below the region can be chosen yet.
      await user.selectOptions(group.getByLabelText("Region"), "Central Luzon (Region III)");
      const province = group.getByLabelText("Province");
      await waitFor(() => expect(province).toBeEnabled());
      expect(group.getByLabelText("City / Municipality")).toBeDisabled();
      expect(group.getByLabelText("Barangay")).toBeDisabled();

      const provinces = within(province)
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(provinces).toContain("Pampanga");
      expect(provinces).not.toContain("Rizal");

      await user.selectOptions(province, "Pampanga");
      const city = group.getByLabelText("City / Municipality");
      expect(city).toBeEnabled();
      const cities = within(city)
        .getAllByRole("option")
        .map((o) => o.textContent);
      expect(cities).toContain("San Fernando");
      expect(cities).not.toContain("Antipolo");

      await user.selectOptions(city, "San Fernando");
      const barangay = group.getByLabelText("Barangay");
      expect(barangay).toBeEnabled();
      const first = within(barangay).getAllByRole("option")[1]?.textContent ?? "";
      await user.selectOptions(barangay, first);
      await user.type(group.getByLabelText("House No. & Street"), "12 Rizal Ave.");
      await user.click(save());

      await waitFor(() => expect(api.called(UPDATE_ROUTE)).toHaveLength(1));
      const body = api.called(UPDATE_ROUTE)[0]?.body as { permanentAddress: string };
      expect(body.permanentAddress).toMatch(
        /^12 Rizal Ave\., Brgy\. .+, San Fernando, Pampanga, Central Luzon \(Region III\)$/,
      );
    });

    it("clears the lower dropdowns when a higher one changes", async () => {
      const user = userEvent.setup();
      openProfile();

      await startEditingProfile(user);
      await user.click(screen.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      const group = within(permanentGroup());
      await user.selectOptions(group.getByLabelText("Region"), "National Capital Region (NCR)");
      const city = group.getByLabelText("City / Municipality");
      await waitFor(() => expect(city).toBeEnabled());
      await user.selectOptions(city, "Manila");
      await user.selectOptions(group.getByLabelText("Barangay"), "Barangay 630");

      await user.selectOptions(group.getByLabelText("City / Municipality"), "Makati");

      expect(group.getByLabelText("Barangay")).toHaveValue("");
    });

    it("mirrors the permanent address when 'Same as permanent address' is checked", async () => {
      const user = userEvent.setup();
      const api = openProfile({ [UPDATE_ROUTE]: { status: 200, body: profile() } });

      await startEditingProfile(user);
      expect(
        within(currentGroup()).getByText("Rm. 305, PUP Dormitory, Sta. Mesa"),
      ).toBeInTheDocument();

      const same = screen.getByRole("checkbox", { name: "Same as permanent address" });
      expect(same).not.toBeChecked();
      await user.click(same);

      // The current address now reads as the permanent one and cannot be edited on its own.
      expect(same).toBeChecked();
      const current = within(currentGroup());
      expect(current.getByText("123 Mabini St., Sta. Mesa, Manila")).toBeInTheDocument();
      expect(current.queryByRole("button", { name: /Edit/ })).toBeNull();
      expect(current.queryByRole("combobox")).toBeNull();

      // It follows the permanent address when that changes.
      await user.click(screen.getByRole("button", { name: "Edit Home Address (Permanent)" }));
      await pickAddress(user, permanentGroup(), {
        region: "National Capital Region (NCR)",
        city: "Manila",
        barangay: "Barangay 630",
        street: "12 Rizal Ave.",
      });
      const joined = "12 Rizal Ave., Brgy. 630, Manila, Metro Manila";
      expect(within(currentGroup()).getByText(joined)).toBeInTheDocument();

      await user.click(save());
      await waitFor(() => expect(api.called(UPDATE_ROUTE)).toHaveLength(1));
      expect(api.called(UPDATE_ROUTE)[0]?.body).toEqual({
        permanentAddress: joined,
        currentAddress: joined,
      });
    });

    it("brings the separate current address back when the box is unchecked", async () => {
      const user = userEvent.setup();
      openProfile();

      await startEditingProfile(user);
      const same = screen.getByRole("checkbox", { name: "Same as permanent address" });
      await user.click(same);
      await user.click(same);

      expect(
        within(currentGroup()).getByText("Rm. 305, PUP Dormitory, Sta. Mesa"),
      ).toBeInTheDocument();
      expect(
        within(currentGroup()).getByRole("button", { name: "Edit Current Residence Address" }),
      ).toBeInTheDocument();
    });

    it("works from the keyboard", async () => {
      const user = userEvent.setup();
      openProfile();

      await startEditingProfile(user);
      const edit = screen.getByRole("button", { name: "Edit Home Address (Permanent)" });
      edit.focus();
      await user.keyboard("{Enter}");

      const group = within(permanentGroup());
      const region = group.getByLabelText("Region");
      await user.selectOptions(region, "National Capital Region (NCR)");
      const city = group.getByLabelText("City / Municipality");
      await waitFor(() => expect(city).toBeEnabled());

      // With no province step, Tab goes region -> city -> barangay -> street.
      region.focus();
      await user.tab();
      expect(city).toHaveFocus();
      await user.selectOptions(city, "Manila");
      await user.tab();
      expect(group.getByLabelText("Barangay")).toHaveFocus();
      await user.selectOptions(group.getByLabelText("Barangay"), "Barangay 630");
      await user.tab();
      expect(group.getByLabelText("House No. & Street")).toHaveFocus();

      // Space presses the "Keep current address" button too.
      await user.tab();
      expect(group.getByRole("button", { name: "Keep current address" })).toHaveFocus();
      await user.keyboard(" ");
      expect(group.queryByRole("combobox")).toBeNull();
      expect(edit).not.toBeInTheDocument();
      expect(group.getByRole("button", { name: "Edit Home Address (Permanent)" })).toHaveFocus();
    });
  });

  describe("AC-STU-002.7: locked fields and the photo uploader", () => {
    it("shows the registrar's fields as read-only text, not inputs", async () => {
      openProfile();

      const name = await screen.findByRole("group", { name: "Full Legal Name" });
      const program = screen.getByRole("group", { name: "Academic Program" });
      expect(within(name).getByText("Juan Santos Dela Cruz")).toBeInTheDocument();
      expect(within(program).getByText("BS in Computer Science")).toBeInTheDocument();
      for (const locked of [name, program]) {
        expect(within(locked).queryByRole("textbox")).toBeNull();
        expect(within(locked).getByText("Locked")).toBeInTheDocument();
      }
    });

    it("explains why a locked field cannot change, from the keyboard too", async () => {
      const user = userEvent.setup();
      openProfile();

      const lock = await screen.findByRole("button", { name: "Why Full Legal Name is locked" });
      lock.focus();
      await user.keyboard("{Enter}");
      expect(lock).toHaveAttribute("aria-expanded", "true");
      expect(lock).toHaveAccessibleDescription(/University\s+Registrar/);

      await user.keyboard("{Escape}");
      expect(lock).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("AC-STU-002.9: emergency contacts", () => {
    const twoContacts = { [CONTACTS_ROUTE]: { status: 200, body: [contact, brother] } };

    const cardFor = (name: string) =>
      screen.getByRole("button", { name: `Edit emergency contact: ${name}` });

    it("unmarks the old primary when another contact is saved as primary", async () => {
      const user = userEvent.setup();
      const api = openProfile({
        ...twoContacts,
        [contactRoute("PATCH", "c2")]: { status: 200, body: { ...brother, isPrimary: true } },
      });

      await startManagingContacts(user);
      expect(within(cardFor("Maria Dela Cruz")).getByText("Primary")).toBeInTheDocument();
      expect(within(cardFor("Pedro Dela Cruz")).queryByText("Primary")).toBeNull();

      await user.click(cardFor("Pedro Dela Cruz"));
      const dialog = await screen.findByRole("dialog", { name: "Edit Emergency Contact" });
      await user.click(within(dialog).getByRole("checkbox", { name: /Primary contact/ }));
      expect(within(dialog).getByText("(will replace the current primary)")).toBeInTheDocument();
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      await waitFor(() =>
        expect(within(cardFor("Pedro Dela Cruz")).getByText("Primary")).toBeInTheDocument(),
      );
      expect(within(cardFor("Maria Dela Cruz")).queryByText("Primary")).toBeNull();
      expect(api.called(contactRoute("PATCH", "c2"))[0]?.body).toMatchObject({ isPrimary: true });
      expect(await screen.findByText("Emergency contacts updated successfully.")).toBeVisible();
    });

    it("unmarks the old primary when a new contact is added as primary", async () => {
      const user = userEvent.setup();
      openProfile({
        [CREATE_CONTACT_ROUTE]: {
          status: 201,
          body: { ...aunt, isPrimary: true },
        },
      });

      await startManagingContacts(user);
      await user.click(await screen.findByRole("button", { name: "Add Emergency Contact" }));
      const dialog = await screen.findByRole("dialog", { name: "Add Emergency Contact" });
      await user.type(within(dialog).getByLabelText(/Full Name/), "Ana Santos");
      await user.type(within(dialog).getByLabelText(/Relationship/), "Aunt");
      await user.type(within(dialog).getByLabelText(/Phone Number/), "09191234567");
      await user.type(within(dialog).getByLabelText(/Email Address/), "ana@example.com");
      await user.click(within(dialog).getByRole("checkbox", { name: /Primary contact/ }));
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      await waitFor(() =>
        expect(within(cardFor("Ana Santos")).getByText("Primary")).toBeInTheDocument(),
      );
      expect(within(cardFor("Maria Dela Cruz")).queryByText("Primary")).toBeNull();
    });

    it("sends one request when Save is double-clicked", async () => {
      const user = userEvent.setup();
      const api = openProfile({ [CREATE_CONTACT_ROUTE]: "pending" });

      await startManagingContacts(user);
      await user.click(await screen.findByRole("button", { name: "Add Emergency Contact" }));
      const dialog = await screen.findByRole("dialog", { name: "Add Emergency Contact" });
      await user.type(within(dialog).getByLabelText(/Full Name/), "Ana Santos");
      await user.type(within(dialog).getByLabelText(/Relationship/), "Aunt");
      await user.type(within(dialog).getByLabelText(/Phone Number/), "09191234567");
      await user.type(within(dialog).getByLabelText(/Email Address/), "ana@example.com");

      await user.dblClick(within(dialog).getByRole("button", { name: "Save contact" }));

      expect(api.called(CREATE_CONTACT_ROUTE)).toHaveLength(1);
      // While the request is out, the button is off and the dialog cannot be dismissed.
      const busy = within(dialog).getByRole("button", { name: "Saving…" });
      expect(busy).toBeDisabled();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: "Add Emergency Contact" })).toBeInTheDocument();
    });

    it("rejects a duplicate of an existing contact with an inline error", async () => {
      const user = userEvent.setup();
      const api = openProfile();

      await startManagingContacts(user);
      await user.click(await screen.findByRole("button", { name: "Add Emergency Contact" }));
      const dialog = await screen.findByRole("dialog", { name: "Add Emergency Contact" });
      // Same person: case, spacing, and +63 versus 09 do not make a new contact.
      await user.type(within(dialog).getByLabelText(/Full Name/), "  maria   DELA cruz ");
      await user.type(within(dialog).getByLabelText(/Relationship/), "Mother");
      await user.type(within(dialog).getByLabelText(/Phone Number/), "+63 917 123 4567");
      await user.type(within(dialog).getByLabelText(/Email Address/), "other@example.com");
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      const phone = within(dialog).getByLabelText(/Phone Number/);
      expect(phone).toHaveAccessibleDescription(
        "A contact with this name and phone number already exists.",
      );
      expect(phone).toBeInvalid();
      expect(api.called(CREATE_CONTACT_ROUTE)).toHaveLength(0);
    });

    it("rejects editing a contact into a duplicate of another", async () => {
      const user = userEvent.setup();
      const api = openProfile(twoContacts);

      await startManagingContacts(user);
      await user.click(cardFor("Pedro Dela Cruz"));
      const dialog = await screen.findByRole("dialog", { name: "Edit Emergency Contact" });
      const name = within(dialog).getByLabelText(/Full Name/);
      const phone = within(dialog).getByLabelText(/Phone Number/);
      await user.clear(name);
      await user.type(name, "Maria Dela Cruz");
      await user.clear(phone);
      await user.type(phone, "09171234567");
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      expect(phone).toHaveAccessibleDescription(
        "A contact with this name and phone number already exists.",
      );
      expect(api.called(contactRoute("PATCH", "c2"))).toHaveLength(0);
    });

    it("lets a contact be saved without changing it, even though it matches itself", async () => {
      const user = userEvent.setup();
      const api = openProfile({ [contactRoute("PATCH", "c1")]: { status: 200, body: contact } });

      await startManagingContacts(user);
      await user.click(cardFor("Maria Dela Cruz"));
      const dialog = await screen.findByRole("dialog", { name: "Edit Emergency Contact" });
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      await waitFor(() => expect(api.called(contactRoute("PATCH", "c1"))).toHaveLength(1));
    });

    it("offers no 'Add Emergency Contact' once there are three, and again after a delete", async () => {
      const user = userEvent.setup();
      openProfile({
        [CONTACTS_ROUTE]: { status: 200, body: [contact, brother, aunt] },
        [contactRoute("DELETE", "c3")]: { status: 204 },
      });

      await startManagingContacts(user);
      expect(await screen.findByText(/maximum of 3 emergency contacts/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Add Emergency Contact" })).toBeNull();

      await user.click(
        screen.getByRole("button", { name: "Delete emergency contact: Ana Santos" }),
      );
      const confirm = await screen.findByRole("dialog", { name: "Delete Emergency Contact" });
      await user.click(within(confirm).getByRole("button", { name: "Delete" }));

      expect(
        await screen.findByRole("button", { name: "Add Emergency Contact" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Ana Santos")).toBeNull();
    });

    it("shows 'Add Emergency Contact' while there is room", async () => {
      const user = userEvent.setup();
      openProfile(twoContacts);

      await startManagingContacts(user);

      expect(
        await screen.findByRole("button", { name: "Add Emergency Contact" }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/maximum of 3/)).toBeNull();
    });

    it("keeps an existing contact address as text until Edit, then uses the PSGC picker", async () => {
      const user = userEvent.setup();
      const api = openProfile({ [contactRoute("PATCH", "c1")]: { status: 200, body: contact } });

      await startManagingContacts(user);
      await user.click(cardFor("Maria Dela Cruz"));
      const dialog = await screen.findByRole("dialog", { name: "Edit Emergency Contact" });
      const group = within(within(dialog).getByRole("group", { name: "Address" }));
      expect(group.getByText("25 Mabini Street, Antipolo City")).toBeInTheDocument();
      expect(group.queryByRole("combobox")).toBeNull();

      await user.click(group.getByRole("button", { name: "Edit Address" }));
      await pickAddress(user, within(dialog).getByRole("group", { name: "Address" }), {
        region: "National Capital Region (NCR)",
        city: "Manila",
        barangay: "Barangay 630",
        street: "123 Mabini St.",
      });
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      await waitFor(() => expect(api.called(contactRoute("PATCH", "c1"))).toHaveLength(1));
      expect(api.called(contactRoute("PATCH", "c1"))[0]?.body).toMatchObject({
        address: "123 Mabini St., Brgy. 630, Manila, Metro Manila",
      });
    });

    it("lets a contact be added without an address", async () => {
      const user = userEvent.setup();
      const api = openProfile({ [CREATE_CONTACT_ROUTE]: { status: 201, body: aunt } });

      await startManagingContacts(user);
      await user.click(await screen.findByRole("button", { name: "Add Emergency Contact" }));
      const dialog = await screen.findByRole("dialog", { name: "Add Emergency Contact" });
      await user.type(within(dialog).getByLabelText(/Full Name/), "Ana Santos");
      await user.type(within(dialog).getByLabelText(/Relationship/), "Aunt");
      await user.type(within(dialog).getByLabelText(/Phone Number/), "09191234567");
      await user.type(within(dialog).getByLabelText(/Email Address/), "ana@example.com");
      await user.click(within(dialog).getByRole("button", { name: "Save contact" }));

      await waitFor(() => expect(api.called(CREATE_CONTACT_ROUTE)).toHaveLength(1));
      expect(api.called(CREATE_CONTACT_ROUTE)[0]?.body).toEqual({
        name: "Ana Santos",
        relationship: "Aunt",
        phone: "09191234567",
        email: "ana@example.com",
        address: null,
        isPrimary: false,
      });
    });

    it("works from the keyboard: open, move through the fields, and Escape", async () => {
      const user = userEvent.setup();
      openProfile();

      const pencil = await screen.findByRole("button", { name: "Edit emergency contacts" });
      pencil.focus();
      await user.keyboard("{Enter}");
      const card = await screen.findByRole("button", {
        name: "Edit emergency contact: Maria Dela Cruz",
      });
      card.focus();
      await user.keyboard("{Enter}");

      const dialog = await screen.findByRole("dialog", { name: "Edit Emergency Contact" });
      const inDialog = within(dialog);
      expect(inDialog.getByLabelText(/Full Name/)).toHaveFocus();
      await user.tab();
      expect(inDialog.getByLabelText(/Relationship/)).toHaveFocus();
      await user.tab();
      expect(inDialog.getByLabelText(/Phone Number/)).toHaveFocus();
      await user.tab();
      expect(inDialog.getByLabelText(/Email Address/)).toHaveFocus();
      await user.tab();
      // The saved address is text with an Edit button; Enter opens the PSGC picker.
      expect(inDialog.getByRole("button", { name: "Edit Address" })).toHaveFocus();
      await user.keyboard("{Enter}");
      // Focus follows into the picker, since the Edit button it came from is gone.
      expect(inDialog.getByLabelText("Region")).toHaveFocus();

      // Escape closes the dialog from a text field (a select keeps it for its own list).
      inDialog.getByLabelText(/Full Name/).focus();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("leaves Escape to an open dropdown instead of closing the dialog", async () => {
      const user = userEvent.setup();
      openProfile();

      await startManagingContacts(user);
      await user.click(await screen.findByRole("button", { name: "Add Emergency Contact" }));
      const dialog = await screen.findByRole("dialog", { name: "Add Emergency Contact" });
      const region = within(dialog).getByLabelText("Region");
      region.focus();
      await user.keyboard("{Escape}");

      expect(screen.getByRole("dialog", { name: "Add Emergency Contact" })).toBeInTheDocument();
    });
  });
});

describe("ProfilePage photo (US-STU-002)", () => {
  describe("the photo format rule", () => {
    const RULE = "JPEG, PNG, or WebP, up to 2 MB.";
    const MB = 1024 * 1024;
    const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const png = (bytes = 10, name = "me.png") =>
      new File([new Uint8Array(bytes)], name, { type: "image/png" });
    const gif = () => new File(["GIF89a"], "me.gif", { type: "image/gif" });

    beforeEach(() => {
      // jsdom has no object URLs; the preview needs one for a file that passes.
      URL.createObjectURL = vi.fn(() => "blob:preview");
      URL.revokeObjectURL = vi.fn();
    });

    it("does not show the rule until a chosen file breaks it", async () => {
      openProfile();

      const upload = await screen.findByRole("button", { name: "Upload profile photo" });

      expect(screen.queryByText(RULE)).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(upload).not.toHaveAccessibleDescription();
    });

    it("refuses a picture that is not a JPEG, PNG, or WebP, and says what is taken", async () => {
      const user = userEvent.setup({ applyAccept: false });
      openProfile();

      const upload = await screen.findByRole("button", { name: "Upload profile photo" });
      await user.upload(fileInput(), gif());

      expect(await screen.findByRole("alert")).toHaveTextContent(RULE);
      expect(upload).toHaveAccessibleDescription(RULE);
      // Nothing was staged for upload.
      expect(screen.queryByRole("button", { name: "Use this photo" })).not.toBeInTheDocument();
    });

    it("refuses a picture over 2 MB with the same words", async () => {
      const user = userEvent.setup();
      openProfile();

      await screen.findByRole("button", { name: "Upload profile photo" });
      await user.upload(fileInput(), png(2 * MB + 1, "big.png"));

      expect(await screen.findByRole("alert")).toHaveTextContent(RULE);
      expect(screen.queryByRole("button", { name: "Use this photo" })).not.toBeInTheDocument();
    });

    it("takes a picture of exactly 2 MB", async () => {
      const user = userEvent.setup();
      openProfile();

      await screen.findByRole("button", { name: "Upload profile photo" });
      await user.upload(fileInput(), png(2 * MB));

      expect(await screen.findByRole("button", { name: "Use this photo" })).toBeVisible();
      expect(screen.queryByText(RULE)).not.toBeInTheDocument();
    });

    it("still takes a WebP picture, which the browser re-encodes as a JPEG", async () => {
      const user = userEvent.setup();
      openProfile();

      await screen.findByRole("button", { name: "Upload profile photo" });
      await user.upload(
        fileInput(),
        new File([new Uint8Array(10)], "me.webp", { type: "image/webp" }),
      );

      expect(await screen.findByRole("button", { name: "Use this photo" })).toBeVisible();
      expect(screen.queryByText(RULE)).not.toBeInTheDocument();
    });

    it("clears the rule once a valid picture is chosen", async () => {
      const user = userEvent.setup({ applyAccept: false });
      openProfile();

      await screen.findByRole("button", { name: "Upload profile photo" });
      await user.upload(fileInput(), gif());
      expect(await screen.findByRole("alert")).toHaveTextContent(RULE);

      await user.upload(fileInput(), png());

      expect(await screen.findByRole("button", { name: "Use this photo" })).toBeVisible();
      expect(screen.queryByText(RULE)).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("clears the rule when the student opens the picker again", async () => {
      const user = userEvent.setup({ applyAccept: false });
      openProfile();

      const upload = await screen.findByRole("button", { name: "Upload profile photo" });
      await user.upload(fileInput(), gif());
      expect(await screen.findByText(RULE)).toBeInTheDocument();

      await user.click(upload);

      expect(screen.queryByText(RULE)).not.toBeInTheDocument();
    });

    it("has no axe violations with the rule showing, and the upload button is reachable by Tab", async () => {
      const user = userEvent.setup({ applyAccept: false });
      openProfile();

      const upload = await screen.findByRole("button", { name: "Upload profile photo" });
      for (let i = 0; i < 60 && document.activeElement !== upload; i += 1) await user.tab();
      expect(upload).toHaveFocus();

      await user.upload(fileInput(), gif());
      await screen.findByRole("alert");

      const results = await axe.run(document.body, {
        rules: { "color-contrast": { enabled: false } },
      });
      expect(results.violations).toEqual([]);
    });

    it("keeps the rule narrow, centred and wrapping, so it fits a 320px column", async () => {
      // jsdom does no layout, so this checks the classes that keep it inside the column.
      const user = userEvent.setup({ applyAccept: false });
      openProfile();

      await screen.findByRole("button", { name: "Upload profile photo" });
      await user.upload(fileInput(), gif());

      const message = await screen.findByRole("alert");
      expect(message.className).toContain("max-w-[13rem]");
      expect(message.className).toContain("text-center");
    });
  });

  describe("a new photo shows in the header at once", () => {
    const NEW_URL = "/api/v1/student/profile/avatar/new";
    const dashboardBody = (avatarUrl: string | null) => ({
      status: "success",
      data: {
        student: {
          student_number: "2021-00456-MN-0",
          name: "Juan Dela Cruz",
          programme: "BSCS",
          year_level: 3,
          enrollment_status: "ENROLLED",
          avatar_url: avatarUrl,
        },
        current_term: { id: "t0", academic_year: "", semester: "", is_current: true },
        holds: [],
        announcements: [],
        events: [],
        recent_activity: [],
        empty_states: { announcements: null, events: null, recent_activity: null },
      },
    });

    afterEach(() => vi.restoreAllMocks());

    it("swaps the header's portrait for the uploaded photo, without a reload", async () => {
      // A browser decodes, crops and encodes the picture; jsdom cannot, so stand in for each step.
      vi.stubGlobal(
        "Image",
        class {
          naturalWidth = 100;
          naturalHeight = 100;
          onload: (() => void) | null = null;
          onerror: (() => void) | null = null;
          set src(_value: string) {
            queueMicrotask(() => this.onload?.());
          }
        },
      );
      URL.createObjectURL = vi.fn(() => "blob:preview");
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) =>
        done(new Blob(["jpeg"], { type: "image/jpeg" })),
      );
      // The stubbed fetch hands back Node's Blob, which jsdom's FileReader refuses.
      vi.spyOn(Response.prototype, "blob").mockImplementation(async function (this: Response) {
        return new Blob([await this.text()], { type: "image/jpeg" });
      });

      const user = userEvent.setup();
      const api = openProfile({
        [DASHBOARD_ROUTE]: [
          { status: 200, body: dashboardBody(null) },
          { status: 200, body: dashboardBody(NEW_URL) },
        ],
        [PROFILE_ROUTE]: [
          { status: 200, body: profile() },
          { status: 200, body: { ...profile(), avatarUrl: NEW_URL } },
        ],
        "GET /student/profile/avatar/new": { status: 200, body: { photo: true } },
      });
      // The mock reads JSON bodies, so answer the multipart upload here and pass the rest on.
      const routed = globalThis.fetch;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: string, init?: RequestInit) =>
          init?.method === "POST" && String(input).endsWith("/student/profile/avatar")
            ? new Response(JSON.stringify({ avatarUrl: NEW_URL, message: "Uploaded" }), {
                status: 200,
              })
            : routed(input, init),
        ),
      );

      const trigger = await screen.findByRole("button", {
        name: "Account menu for Juan Dela Cruz",
      });
      // No photo yet: the header shows the same local portrait this page does.
      await waitFor(() =>
        expect(trigger.querySelector("img")?.getAttribute("src")).toBe(AVATAR_PLACEHOLDER),
      );

      await user.upload(
        document.querySelector<HTMLInputElement>('input[type="file"]')!,
        new File([new Uint8Array(10)], "me.png", { type: "image/png" }),
      );
      await user.click(await screen.findByRole("button", { name: "Use this photo" }));

      await waitFor(() =>
        expect(trigger.querySelector("img")?.getAttribute("src")).toMatch(/^data:/),
      );
      expect(trigger).not.toHaveTextContent("J");
      expect(api.called("GET /student/profile/avatar/new").length).toBeGreaterThan(0);
    });
  });
});
