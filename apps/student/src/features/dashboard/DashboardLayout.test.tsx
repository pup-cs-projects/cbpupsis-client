import { mockApi } from "@cbpupsis/account/testing";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";
import { AVATAR_PLACEHOLDER } from "../profile/useAvatar";

const DASHBOARD_ROUTE = "GET /student/dashboard";

function dashboard(student: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      student: {
        student_number: "2021-00456-MN-0",
        name: "Juan Dela Cruz",
        programme: "BS Computer Science",
        year_level: 3,
        enrollment_status: "ENROLLED",
        avatar_url: null,
        ...student,
      },
      current_term: { id: "t0", academic_year: "", semester: "", is_current: true },
      holds: [],
      standing: { value: "GOOD", unit_reduction: 0 },
      enrollment: { enrolled_units: "0", effective_ceiling: "0", prescribed_load: "0" },
      periods: [],
      announcements: [],
      events: [],
      recent_activity: [],
      empty_states: { announcements: null, events: null, recent_activity: null },
    },
  };
}

async function openAccountMenu() {
  const user = userEvent.setup();
  const trigger = await screen.findByRole("button", { name: "Account menu for Juan Dela Cruz" });
  await user.click(trigger);
  return user;
}

afterEach(async () => {
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("header account menu", () => {
  it("opens to the signed-in student's full identity, with no first name beside the avatar", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    renderApp("/dashboard");

    await screen.findByRole("button", { name: "Account menu for Juan Dela Cruz" });
    expect(screen.queryByText("Juan")).not.toBeInTheDocument();
    await openAccountMenu();

    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("2021-00456-MN-0")).toBeInTheDocument();
    expect(screen.getByText(me.email)).toBeInTheDocument();
  });

  it("opens the profile, and marks itself current there", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
      "GET /student/profile": {
        status: 200,
        body: {
          studentId: "2021-00456-MN-0",
          avatarUrl: null,
          fields: { firstName: { value: "Juan", editable: false } },
        },
      },
      "GET /student/profile/emergency-contacts": { status: 200, body: [] },
    });
    const router = renderApp("/dashboard");
    const user = await openAccountMenu();

    const profileLink = screen.getByRole("link", { name: "Profile" });
    expect(profileLink).not.toHaveAttribute("aria-current");
    await user.click(profileLink);

    expect(await screen.findByRole("heading", { name: "Student Profile" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/profile");

    await openAccountMenu();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  });

  it("lists Profile, Settings, then Logout, with no Change Password item", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    renderApp("/dashboard");
    await openAccountMenu();

    const items = [
      screen.getByRole("link", { name: "Profile" }),
      screen.getByRole("link", { name: "Settings" }),
      screen.getByRole("button", { name: "Logout" }),
    ];
    for (const [index, item] of items.entries()) {
      const next = items[index + 1];
      if (next) {
        expect(item.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    }
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("button", { name: "Logout" })).toHaveClass("text-red-600");
    expect(screen.queryByRole("link", { name: "Change Password" })).not.toBeInTheDocument();
  });

  it("opens Settings, which holds the change-password form, and marks itself current", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    const router = renderApp("/dashboard");
    const user = await openAccountMenu();

    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Change Password" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/settings");

    await openAccountMenu();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    renderApp("/dashboard");
    const user = await openAccountMenu();

    expect(screen.getByText(me.email)).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByText(me.email)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu for Juan Dela Cruz" })).toHaveFocus();
  });

  it("keeps Sign out as its own menu item, distinct from the links", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    renderApp("/dashboard");
    await openAccountMenu();

    const signOut = screen.getByRole("button", { name: "Logout" });
    expect(signOut).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Logout" })).not.toBeInTheDocument();
  });

  it("announces the signed-in account for assistive tech, independent of the dashboard request", async () => {
    signInDirectly();
    // No dashboard route mocked: the sign-in announcement must not depend on it.
    mockApi({ [ME_ROUTE]: { status: 200, body: me } });
    renderApp("/dashboard");

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
  });
});

describe("sidebar: Help & Support is pinned to the bottom", () => {
  const AXE = { rules: { "color-contrast": { enabled: false } } };
  const HELP = "Help & Support: email portal support";

  async function openSidebar({ expanded = false } = {}) {
    localStorage.setItem("student-sidebar-expanded", String(expanded));
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    renderApp("/dashboard");
    await screen.findByRole("button", { name: "Account menu for Juan Dela Cruz" });
    return screen.getByRole("navigation", { name: "Student modules" });
  }

  afterEach(() => localStorage.removeItem("student-sidebar-expanded"));

  /** The sidebar holds modules only: settings are in the account menu, not here. */
  function expectNoSettingsGroup(sidebar: HTMLElement) {
    for (const name of ["Settings", "Change Password"]) {
      expect(within(sidebar).queryByRole("button", { name })).not.toBeInTheDocument();
      expect(within(sidebar).queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(within(sidebar).queryByText(/settings|change password/i)).not.toBeInTheDocument();
    const modules = within(within(sidebar).getByRole("list")).getAllByRole("button");
    expect(modules.map((module) => module.getAttribute("aria-label"))).toEqual([
      "Academics",
      "Finance",
      "Forms & Requests",
    ]);
  }

  it("has no Settings group in the sidebar, collapsed or expanded", async () => {
    expectNoSettingsGroup(await openSidebar({ expanded: true }));
  });

  it("sits in a footer of its own, apart from the modules and after the last of them", async () => {
    const nav = await openSidebar({ expanded: true });
    const help = within(nav).getByRole("link", { name: HELP });
    const forms = within(nav).getByRole("button", { name: "Forms & Requests" });

    // Not one of the modules: the list of modules holds Academics, Finance, and Forms only.
    const modules = within(nav).getByRole("list");
    expect(within(modules).getAllByRole("listitem")).toHaveLength(3);
    expect(modules).not.toContainElement(help);
    expect(within(modules).queryByRole("link", { name: HELP })).not.toBeInTheDocument();
    expect(forms.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Pushed to the bottom of the nav, under a divider, and the modules scroll above it.
    const footer = help.parentElement as HTMLElement;
    expect(footer.className).toContain("mt-auto");
    expect(footer.firstElementChild?.className).toContain("border-t");
    expect(nav.className).toContain("flex-col");
    expect(modules.parentElement?.className).toMatch(
      /flex-1.*overflow-y-auto|overflow-y-auto.*flex-1/,
    );
    expect(footer.className).toContain("shrink-0");
    expect(footer.nextElementSibling).toBeNull();
  });

  it("emails support, with its name and destination in words, expanded", async () => {
    const nav = await openSidebar({ expanded: true });

    const help = within(nav).getByRole("link", { name: HELP });

    expect(help).toHaveAttribute("href", "mailto:icto-admin@pup.edu.ph");
    expect(help).toHaveTextContent("Help & Support");
  });

  it("stays reachable by name, as an icon, when the sidebar is collapsed", async () => {
    const nav = await openSidebar({ expanded: false });

    const help = within(nav).getByRole("link", { name: HELP });

    expect(help).toHaveAttribute("href", "mailto:icto-admin@pup.edu.ph");
    expect(help).not.toHaveTextContent("Help & Support");
    expect(help.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(help.className).toContain("min-h-11");
    expect(help.className).toContain("justify-center");
  });

  it("is last in the keyboard order, after an open module's items", async () => {
    const nav = await openSidebar({ expanded: true });
    const user = userEvent.setup();
    await user.click(within(nav).getByRole("button", { name: "Academics" }));

    const focusables = Array.from(
      nav.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"),
    ).map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim());

    expect(focusables.at(-1)).toBe(HELP);
    expect(focusables.indexOf("My Schedule")).toBeLessThan(focusables.indexOf(HELP));

    const help = within(nav).getByRole("link", { name: HELP });
    for (let i = 0; i < 40 && document.activeElement !== help; i += 1) await user.tab();
    expect(help).toHaveFocus();
  });

  it("has no axe violations collapsed or expanded", async () => {
    await openSidebar({ expanded: false });
    expect((await axe.run(document.body, AXE)).violations).toEqual([]);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Expand menu" }));
    expect(await screen.findByRole("button", { name: "Collapse menu" })).toBeInTheDocument();
    expect((await axe.run(document.body, AXE)).violations).toEqual([]);
  });

  describe("in the mobile drawer (320px)", () => {
    // jsdom does no layout, so it cannot measure clipping. It can check what prevents it: the
    // drawer is a fixed, full-height column, the modules scroll inside it, and the footer is
    // outside that scroll area and cannot shrink, so it is never pushed off or overlapped.
    async function openDrawer() {
      await openSidebar();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Menu" }));
      const drawer = document.getElementById("student-sidebar") as HTMLElement;
      return { user, drawer };
    }

    it("has no Settings group in the drawer either", async () => {
      const { drawer } = await openDrawer();

      expectNoSettingsGroup(drawer);
    });

    it("shows the label beside the icon, in a full-height column with the footer outside the scroll area", async () => {
      const { drawer } = await openDrawer();

      const help = within(drawer).getByRole("link", { name: HELP });
      const footer = help.parentElement as HTMLElement;
      const scroller = within(drawer).getByRole("list").parentElement as HTMLElement;

      expect(drawer.className).toMatch(/fixed.*inset-y-0.*flex.*w-72/);
      expect(help).toHaveTextContent("Help & Support");
      expect(scroller.className).toContain("min-h-0");
      expect(scroller.className).toContain("overflow-y-auto");
      expect(scroller).not.toContainElement(help);
      expect(footer.className).toContain("shrink-0");
      expect(footer.className).toContain("mt-auto");
      expect(help.className).toContain("min-h-11");
    });

    it("has no axe violations and Escape returns focus to the menu button", async () => {
      const { user, drawer } = await openDrawer();

      expect((await axe.run(document.body, AXE)).violations).toEqual([]);

      within(drawer).getByRole("link", { name: HELP }).focus();
      await user.keyboard("{Escape}");

      expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus();
    });
  });
});

describe("header avatar trigger", () => {
  const AXE = { rules: { "color-contrast": { enabled: false } } };
  const PROFILE_ROUTE = "GET /student/profile";
  const PHOTO_URL = "/api/v1/student/profile/avatar/a1";
  const PHOTO_ROUTE = "GET /student/profile/avatar/a1";
  const OLD_PHOTO_URL = "/api/v1/student/profile/avatar/old";

  const profile = (avatarUrl: string | null) => ({
    studentId: "2021-00456-MN-0",
    avatarUrl,
    fields: { firstName: { value: "Juan", editable: false } },
  });

  // The stubbed fetch hands back Node's Blob, which jsdom's FileReader refuses; a real browser's
  // is the one it reads. Give the page jsdom's Blob so the picture can be turned into a data URL.
  beforeEach(() => {
    vi.spyOn(Response.prototype, "blob").mockImplementation(async function (this: Response) {
      return new Blob([await this.text()], { type: "image/png" });
    });
  });
  afterEach(() => vi.restoreAllMocks());

  /** Opens the dashboard (not the profile page) and returns the account trigger. */
  async function openHeader(
    routes: Record<string, Parameters<typeof mockApi>[0][string]> = {},
    student: Record<string, unknown> = {},
  ) {
    signInDirectly();
    const api = mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard(student) },
      [PROFILE_ROUTE]: { status: 200, body: profile(null) },
      ...routes,
    });
    renderApp("/dashboard");
    const trigger = await screen.findByRole("button", {
      name: student.name === null ? "Account menu" : "Account menu for Juan Dela Cruz",
    });
    return { trigger, api };
  }

  /** The picture in the trigger, once the profile has answered and it is showing. */
  const photoIn = (trigger: HTMLElement) =>
    waitFor(() => {
      const img = trigger.querySelector("img");
      expect(img).not.toBeNull();
      return img as HTMLImageElement;
    });

  it("shows only the avatar and the chevron: no name, in words or in print", async () => {
    const { trigger } = await openHeader();
    await photoIn(trigger);

    // Nothing but the picture and the chevron: the name is in the button's accessible name.
    expect(trigger).toHaveTextContent(/^$/);
    expect(trigger).not.toHaveTextContent("Juan");
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
    expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the photo from the profile, on a page that is not the profile page", async () => {
    // The reported bug: the profile has the photo, and the dashboard's own avatar_url is empty.
    const { trigger, api } = await openHeader(
      { [PROFILE_ROUTE]: { status: 200, body: profile(PHOTO_URL) }, [PHOTO_ROUTE]: photoReply() },
      { avatar_url: null },
    );

    const photo = await waitFor(() => {
      const img = trigger.querySelector("img");
      expect(img?.getAttribute("src")).toMatch(/^data:/);
      return img as HTMLImageElement;
    });

    expect(api.called(PROFILE_ROUTE)).toHaveLength(1);
    expect(api.called(PHOTO_ROUTE)).toHaveLength(1);
    expect(photo).toHaveClass("rounded-full", "object-cover", "h-9", "w-9");
    // Decorative: the button's own name already says whose account it is.
    expect(photo).toHaveAttribute("alt", "");
  });

  it("shows the same local portrait the profile page does when there is no photo", async () => {
    const { trigger, api } = await openHeader(
      { [PROFILE_ROUTE]: { status: 200, body: profile(null) } },
      { avatar_url: null },
    );

    const photo = await photoIn(trigger);

    expect(photo.getAttribute("src")).toBe(AVATAR_PLACEHOLDER);
    expect(AVATAR_PLACEHOLDER).toBe("/assets/profile-placeholder.webp");
    expect(photo).toHaveClass("object-cover");
    // No initial, and no request for a picture that does not exist.
    expect(trigger).toHaveTextContent(/^$/);
    expect(api.called(PHOTO_ROUTE)).toHaveLength(0);
  });

  it("follows the profile, not the dashboard, when the two disagree", async () => {
    // An older picture on the dashboard's record must not outrank what the profile page shows.
    const { trigger, api } = await openHeader(
      { [PROFILE_ROUTE]: { status: 200, body: profile(null) } },
      { avatar_url: OLD_PHOTO_URL },
    );

    const photo = await photoIn(trigger);

    expect(photo.getAttribute("src")).toBe(AVATAR_PLACEHOLDER);
    expect(api.called("GET /student/profile/avatar/old")).toHaveLength(0);
  });

  it("uses the dashboard's photo when the profile cannot be read", async () => {
    const { trigger } = await openHeader(
      {
        [PROFILE_ROUTE]: { status: 500, body: { detail: "Internal error" } },
        [PHOTO_ROUTE]: photoReply(),
      },
      { avatar_url: PHOTO_URL },
    );

    await waitFor(() =>
      expect(trigger.querySelector("img")?.getAttribute("src")).toMatch(/^data:/),
    );
  });

  it("waits for the profile with an empty circle, rather than flashing a stand-in", async () => {
    const { trigger } = await openHeader({ [PROFILE_ROUTE]: "pending" });

    expect(trigger.querySelector("img")).toBeNull();
    // Not an initial either: nothing to read until the picture is known.
    expect(trigger).toHaveTextContent(/^$/);
    expect(trigger.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the local portrait, as the profile page does, when the photo cannot be fetched", async () => {
    const { trigger } = await openHeader({
      [PROFILE_ROUTE]: { status: 200, body: profile(PHOTO_URL) },
      [PHOTO_ROUTE]: { status: 404, body: { detail: "Not found" } },
    });

    const photo = await photoIn(trigger);

    expect(photo.getAttribute("src")).toBe(AVATAR_PLACEHOLDER);
  });

  it("falls back to the student's initial only when the picture itself will not display", async () => {
    const { trigger } = await openHeader();
    const photo = await photoIn(trigger);
    expect(trigger).not.toHaveTextContent("J");

    fireEvent.error(photo);

    await waitFor(() => expect(trigger.querySelector("img")).toBeNull());
    expect(trigger).toHaveTextContent(/^J$/);
    expect(trigger.querySelector('span[aria-hidden="true"]')).toHaveTextContent("J");
  });

  it("falls back to a neutral initial when the picture fails and the University has no name", async () => {
    const { trigger } = await openHeader({}, { name: null });

    fireEvent.error(await photoIn(trigger));

    await waitFor(() => expect(trigger).toHaveTextContent(/^S$/));
  });

  it("opens from the keyboard, and the menu is reachable by Tab", async () => {
    const { trigger } = await openHeader();
    const user = userEvent.setup();

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.tab();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Logout" })).toHaveFocus();
  });

  it("has no axe violations with the portrait, with the menu open, or with a photo", async () => {
    const { trigger } = await openHeader();
    await photoIn(trigger);
    expect((await axe.run(document.body, AXE)).violations).toEqual([]);

    await userEvent.setup().click(trigger);
    expect((await axe.run(document.body, AXE)).violations).toEqual([]);
  });

  it("has no axe violations with the photo, the loading circle, or the initial", async () => {
    const photo = await openHeader({
      [PROFILE_ROUTE]: { status: 200, body: profile(PHOTO_URL) },
      [PHOTO_ROUTE]: photoReply(),
    });
    await waitFor(() =>
      expect(photo.trigger.querySelector("img")?.getAttribute("src")).toMatch(/^data:/),
    );
    expect((await axe.run(document.body, AXE)).violations).toEqual([]);

    fireEvent.error(photo.trigger.querySelector("img") as HTMLImageElement);
    await waitFor(() => expect(photo.trigger).toHaveTextContent("J"));
    expect((await axe.run(document.body, AXE)).violations).toEqual([]);
  });

  it("has no axe violations while the profile is still loading", async () => {
    await openHeader({ [PROFILE_ROUTE]: "pending" });

    expect((await axe.run(document.body, AXE)).violations).toEqual([]);
  });

  it("stays a compact, full-height touch target, so it cannot crowd a 320px header", async () => {
    // jsdom does no layout. Dropping the name left the trigger a 36px circle and a chevron (at
    // every width, not only below the `sm` breakpoint), inside a cluster that never shrinks.
    const { trigger } = await openHeader();
    const photo = await photoIn(trigger);

    expect(trigger.className).toContain("p-1.5");
    expect(photo).toHaveClass("h-9", "w-9");
    expect(trigger.parentElement?.parentElement?.className).toContain("shrink-0");
    expect(document.querySelector("header")?.className).toContain("px-4");
  });
});

/** The picture's bytes, as the API streams them. */
function photoReply() {
  return { status: 200, body: { photo: true } };
}
