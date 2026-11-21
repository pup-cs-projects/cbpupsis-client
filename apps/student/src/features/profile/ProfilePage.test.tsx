import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";
import { AVATAR_PLACEHOLDER } from "./useAvatar";

const DASHBOARD_ROUTE = "GET /student/me/dashboard";
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
