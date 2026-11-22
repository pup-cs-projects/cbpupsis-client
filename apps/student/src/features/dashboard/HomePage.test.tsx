import { mockApi } from "@cbpupsis/account/testing";
import { configure, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

// US-STU-001: the student dashboard's home page.

// The first test renders the whole app cold. Under CI load that can pass Testing Library's default
// one second, which would fail a test that is right.
configure({ asyncUtilTimeout: 5000 });

const DASHBOARD_ROUTE = "GET /student/dashboard";

// Monday 10 August 2026, 12:00 in Manila. Every date below is relative to it.
const NOW = new Date("2026-08-10T12:00:00+08:00");

const DAY_MS = 86_400_000;
/** An instant `days` before NOW, as the API sends it. */
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString();

const STUDENT = {
  student_number: "2021-00456-MN-0",
  name: "Maria Clara Santos",
  programme: "BSCS",
  year_level: 3,
  enrollment_status: "ENROLLED",
  avatar_url: null,
};

const HOLD = {
  type: "FINANCIAL",
  office: "Cashier",
  description: "Unpaid tuition balance.",
  amount_outstanding: "1500.00",
  currency: "PHP",
  is_blocking: true,
  blocks_enrollment: true,
  blocks: ["ENROLLMENT", "COR"],
};

function activity(id: string, occurredAt: string, description: string, type = "AUDIT") {
  return { id, occurred_at: occurredAt, type, severity: "INFO", description };
}

function event(id: string, title: string, start: string, end = start, multiDay = false) {
  return {
    id,
    title,
    starts_at: `${start}T00:00:00+08:00`,
    ends_at: `${end}T23:59:00+08:00`,
    is_multi_day: multiDay,
    category: "ACADEMIC_CALENDAR",
    description: null,
  };
}

function dashboard(data: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      student: STUDENT,
      current_term: { id: "t1", academic_year: "2026-2027", semester: "first", is_current: true },
      holds: [],
      standing: { value: "GOOD", unit_reduction: 0 },
      enrollment: { enrolled_units: "21.0", effective_ceiling: "24.0", prescribed_load: "21.0" },
      periods: [],
      announcements: [],
      events: [],
      recent_activity: [],
      empty_states: { announcements: null, events: null, recent_activity: null },
      ...data,
    },
  };
}

function openHome(data: Record<string, unknown> = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [DASHBOARD_ROUTE]: { status: 200, body: dashboard(data) },
  });
  renderApp("/dashboard");
  return api;
}

/** The section under a heading, found by its accessible name. */
const section = (name: string) => screen.getByRole("region", { name });

/** A section once its data has arrived, not while it still shows its loading placeholder. */
async function loadedSection(name: string) {
  const card = await screen.findByRole("region", { name });
  await waitFor(() => expect(within(card).queryByText(/^Loading /)).not.toBeInTheDocument());
  return card;
}

/** The notice saying holds could not be checked: a status region, found by its words. */
async function holdsNotice() {
  const words = await screen.findByText("We couldn't check your account holds.");
  return words.closest('[role="status"]') as HTMLElement;
}

const originalScrollIntoView = Element.prototype.scrollIntoView;

beforeEach(() => {
  // Only the clock: timers stay real, so the page and its queries run as they do for a student.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(async () => {
  vi.useRealTimers();
  Element.prototype.scrollIntoView = originalScrollIntoView;
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("AC-STU-001.1: programme, year level, and enrollment status beside the name", () => {
  it("shows them in one plain line under the name, not as chips", async () => {
    openHome();

    const heading = await screen.findByRole("heading", {
      name: "Welcome back, Maria Clara Santos!",
    });
    const details = screen.getByText("BSCS · 3rd year · Enrolled");

    // Plain text in the welcome section, straight after the name.
    expect(details.tagName).toBe("P");
    expect(section("Welcome back, Maria Clara Santos!")).toContainElement(details);
    expect(
      heading.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('says "Not enrolled this term" for a student with no enrollment, not a blank', async () => {
    openHome({ student: { ...STUDENT, enrollment_status: "NOT_ENROLLED" } });

    expect(await screen.findByText("BSCS · 3rd year · Not enrolled this term")).toBeInTheDocument();
  });

  it('says "Not enrolled this term" when the API sends no status at all', async () => {
    openHome({ student: { ...STUDENT, enrollment_status: null } });

    expect(await screen.findByText("BSCS · 3rd year · Not enrolled this term")).toBeInTheDocument();
  });

  it("says in words which detail is missing, and never shows null or undefined", async () => {
    openHome({ student: { ...STUDENT, programme: null, year_level: null, enrollment_status: "" } });

    expect(
      await screen.findByText(
        "Program unavailable · Year level unavailable · Not enrolled this term",
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\b(null|undefined)\b/i);
  });

  it("keeps the other details when only the programme is missing", async () => {
    openHome({ student: { ...STUDENT, programme: "" } });

    expect(
      await screen.findByText("Program unavailable · 3rd year · Enrolled"),
    ).toBeInTheDocument();
  });
});

describe("AC-STU-001.2: hold banners", () => {
  it("shows no banner when the student has no holds", async () => {
    openHome({ holds: [] });

    await screen.findByRole("heading", { name: /Welcome back/ });
    expect(screen.queryByText(/Hold from/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Blocks enrollment/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // And nothing that says holds could not be checked.
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    expect(screen.queryByText(/couldn't check your account holds/)).not.toBeInTheDocument();
  });

  it("shows one banner per hold, with its office, description, amount, and what it blocks", async () => {
    openHome({
      holds: [
        HOLD,
        {
          ...HOLD,
          type: "ACADEMIC",
          office: "Registrar",
          description: "Missing grade submission.",
          amount_outstanding: "0.00",
        },
      ],
    });

    const banners = await screen.findAllByRole("alert");
    expect(banners).toHaveLength(2);

    const [cashier, registrar] = banners;
    expect(within(cashier!).getByText("Hold from Cashier")).toBeInTheDocument();
    expect(within(cashier!).getByText("Unpaid tuition balance.")).toBeInTheDocument();
    expect(within(cashier!).getByText("₱1,500.00")).toBeInTheDocument();
    expect(within(cashier!).getByText("Blocks enrollment")).toBeInTheDocument();

    expect(within(registrar!).getByText("Hold from Registrar")).toBeInTheDocument();
    expect(within(registrar!).getByText("Missing grade submission.")).toBeInTheDocument();
    expect(within(registrar!).getByText("Blocks enrollment")).toBeInTheDocument();
    // Nothing owed, so no amount; never a default one.
    expect(within(registrar!).queryByText(/₱|PHP|Amount due/)).not.toBeInTheDocument();
  });

  it("puts the banners above the welcome section", async () => {
    openHome({ holds: [HOLD] });

    const banner = await screen.findByRole("alert");
    const welcome = screen.getByRole("heading", { name: /Welcome back/ });

    expect(banner.compareDocumentPosition(welcome) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says a hold does not block enrollment when the API says so", async () => {
    openHome({ holds: [{ ...HOLD, blocks_enrollment: false }] });

    const banner = await screen.findByRole("alert");

    expect(within(banner).getByText("Does not block enrollment")).toBeInTheDocument();
    expect(within(banner).queryByText("Blocks enrollment")).not.toBeInTheDocument();
  });

  it("says holds could not be checked when the API sends null, with Retry, and no amount", async () => {
    signInDirectly();
    const api = mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: [
        { status: 200, body: dashboard({ holds: null }) },
        { status: 200, body: dashboard({ holds: [HOLD] }) },
      ],
    });
    renderApp("/dashboard");

    const notice = await holdsNotice();
    // The student is never told they are clear, and never shown an invented amount.
    expect(screen.queryByText(/₱|PHP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Blocks enrollment/)).not.toBeInTheDocument();

    await userEvent.click(within(notice).getByRole("button", { name: "Retry" }));

    // Retry asks again, and the real hold appears in place of the notice.
    expect(await screen.findByText("Hold from Cashier")).toBeInTheDocument();
    expect(screen.getByText("₱1,500.00")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't check your account holds/)).not.toBeInTheDocument();
    expect(api.called(DASHBOARD_ROUTE)).toHaveLength(2);
  });

  it("says holds could not be checked when the whole dashboard fails to load, and Retry loads it", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: [
        { status: 500, body: { detail: "Internal error", request_id: "req-1" } },
        { status: 200, body: dashboard({ holds: [HOLD] }) },
      ],
    });
    renderApp("/dashboard");

    const notice = await holdsNotice();
    expect(screen.queryByText(/₱|PHP/)).not.toBeInTheDocument();

    await userEvent.click(within(notice).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Hold from Cashier")).toBeInTheDocument();
  });
});

describe("AC-STU-001.13: a hold never rests on color alone", () => {
  it("gives each hold banner a warning icon and its status in words", async () => {
    openHome({ holds: [HOLD, { ...HOLD, office: "Registrar" }] });

    const banners = await screen.findAllByRole("alert");

    expect(banners).toHaveLength(2);
    for (const banner of banners) {
      // The icon is decorative (hidden from screen readers) because the words say it all.
      const icon = banner.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(banner).toHaveTextContent(/Hold from/);
      expect(banner).toHaveTextContent("Blocks enrollment");
    }
  });

  it("gives the could-not-check notice an icon and words too", async () => {
    openHome({ holds: null });

    const notice = await holdsNotice();

    expect(notice.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(notice).toHaveTextContent("We couldn't check your account holds.");
  });

  it("says a warning in recent activity in words as well as with its bar", async () => {
    openHome({
      recent_activity: [
        {
          id: "w1",
          occurred_at: daysAgo(1),
          type: "LOGIN_FAILED",
          severity: "WARNING",
          description: "Login attempt failed. AUTH_FAILED",
        },
      ],
    });

    expect(await screen.findByText(/Needs attention/)).toBeVisible();
  });
});

describe("Recent activity: plain English, three on the card, 90 days in full", () => {
  it("never shows a raw error code or event key", async () => {
    openHome({
      recent_activity: [
        {
          id: "a1",
          occurred_at: daysAgo(1),
          type: "LOGIN_FAILED",
          severity: "WARNING",
          description: "Login attempt failed. AUTH_FAILED",
        },
        activity("a2", daysAgo(2), "Action emergency_contact.created completed."),
        activity("a3", daysAgo(3), "Action emergency_contact.updated completed."),
      ],
    });

    expect(await screen.findByText("Sign-in attempt failed")).toBeInTheDocument();
    expect(screen.getByText("Emergency contact added.")).toBeInTheDocument();
    expect(screen.getByText("Emergency contact updated.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/AUTH_FAILED|AUTH_INVALID|emergency_contact/);
    expect(document.body.textContent).not.toMatch(/\bAction .* completed\b/);
  });

  it("shows only the three newest on the card, newest first, whatever order the API sends", async () => {
    openHome({
      recent_activity: [
        activity("a2", daysAgo(2), "Second newest."),
        activity("a5", daysAgo(5), "Fifth newest."),
        activity("a1", daysAgo(1), "Newest."),
        activity("a4", daysAgo(4), "Fourth newest."),
        activity("a3", daysAgo(3), "Third newest."),
      ],
    });

    const card = await loadedSection("Recent Activity");
    const items = within(card).getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(items.map((item) => within(item).getByText(/newest|Newest/).textContent)).toEqual([
      "Newest.",
      "Second newest.",
      "Third newest.",
    ]);
    expect(within(card).queryByText("Fourth newest.")).not.toBeInTheDocument();
  });

  it("opens the past 90 days in full from View all activity, with a note saying so", async () => {
    openHome({
      recent_activity: [
        activity("a1", daysAgo(1), "Newest."),
        activity("a2", daysAgo(10), "Ten days ago."),
        activity("a3", daysAgo(30), "Thirty days ago."),
        activity("a4", daysAgo(89), "Eighty-nine days ago."),
        activity("a5", daysAgo(91), "Ninety-one days ago."),
        activity("a6", daysAgo(200), "Two hundred days ago."),
      ],
    });
    const user = userEvent.setup();

    const button = await screen.findByRole("button", { name: "View all activity" });
    await user.click(button);

    const dialog = await screen.findByRole("dialog", { name: "All activity" });
    expect(within(dialog).getByText("Showing activity from the past 90 days")).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((item) => item.textContent)
        .map((text) => text.replace(/^.*•\s*\d+:\d+ [AP]M/, "")),
    ).toEqual(["Newest.", "Ten days ago.", "Thirty days ago.", "Eighty-nine days ago."]);
    expect(within(dialog).queryByText("Ninety-one days ago.")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Two hundred days ago.")).not.toBeInTheDocument();
  });

  it("closes the full log with Escape and gives focus back to the button that opened it", async () => {
    openHome({ recent_activity: [activity("a1", daysAgo(1), "Newest.")] });
    const user = userEvent.setup();

    const button = await screen.findByRole("button", { name: "View all activity" });
    await user.click(button);
    expect(await screen.findByRole("dialog", { name: "All activity" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });

  it("says so, in the dialog, when nothing happened in the past 90 days", async () => {
    openHome({ recent_activity: [activity("a1", daysAgo(120), "Long ago.")] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "View all activity" }));

    const dialog = await screen.findByRole("dialog", { name: "All activity" });
    expect(within(dialog).getByText("No activity in the past 90 days.")).toBeInTheDocument();
  });

  it("offers no View all activity when there is no activity at all", async () => {
    openHome({ recent_activity: [] });

    await screen.findByText(/activity will appear here/);
    expect(screen.queryByRole("button", { name: "View all activity" })).not.toBeInTheDocument();
  });
});

describe("Events: three upcoming on the card, the whole calendar on demand", () => {
  const EVENTS = [
    event("e-old-1", "Orientation Week", "2026-06-01"),
    event("e-old-2", "Midterm Exams", "2026-07-06", "2026-07-10", true),
    event("e-now", "Adjustment Period", "2026-08-07", "2026-08-12", true),
    event("e-today", "Enrollment Fair", "2026-08-10"),
    event("e-soon", "Start of Classes", "2026-08-17"),
    event("e-later", "Tuition Deadline", "2026-09-15"),
    event("e-last", "Foundation Day", "2026-10-30"),
  ];

  it("hides what has ended and shows at most three of what has not, soonest first", async () => {
    openHome({ events: EVENTS });

    const card = await loadedSection("Events");
    const rows = within(card).getAllByRole("listitem");

    expect(rows).toHaveLength(3);
    // Under way (ends Aug 12), today, and the next one. Not the past; not a fourth.
    expect(rows[0]).toHaveTextContent("Adjustment Period");
    expect(rows[1]).toHaveTextContent("Enrollment Fair");
    expect(rows[2]).toHaveTextContent("Start of Classes");
    expect(within(card).queryByText("Orientation Week")).not.toBeInTheDocument();
    expect(within(card).queryByText("Midterm Exams")).not.toBeInTheDocument();
    expect(within(card).queryByText("Tuition Deadline")).not.toBeInTheDocument();
  });

  it("goes by the date in Manila, not in UTC", async () => {
    // 20:00 UTC on August 10 is already August 11 in Manila: Aug 10's event is over.
    vi.setSystemTime(new Date("2026-08-10T20:00:00Z"));
    openHome({ events: [event("e-yesterday", "Enrollment Fair", "2026-08-10")] });

    const card = await loadedSection("Events");

    expect(within(card).queryByText("Enrollment Fair")).not.toBeInTheDocument();
    expect(
      within(card).getByText("No upcoming events on the academic calendar."),
    ).toBeInTheDocument();
  });

  it("says there are no upcoming events when all of them are past, and still offers the calendar", async () => {
    openHome({ events: [EVENTS[0]!, EVENTS[1]!] });

    const card = await loadedSection("Events");

    expect(
      within(card).getByText("No upcoming events on the academic calendar."),
    ).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Full Academic Calendar" })).toBeEnabled();
  });

  it("opens the full calendar with every event, past and upcoming", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    openHome({ events: EVENTS });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Full Academic Calendar" }));

    const dialog = await screen.findByRole("dialog", { name: "Full Academic Calendar" });
    for (const title of [
      "Orientation Week",
      "Midterm Exams",
      "Adjustment Period",
      "Enrollment Fair",
      "Start of Classes",
      "Tuition Deadline",
      "Foundation Day",
    ]) {
      expect(within(dialog).getByText(title)).toBeInTheDocument();
    }
  });

  it("opens the calendar at today, with the past above it to scroll up to", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    openHome({ events: EVENTS });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Full Academic Calendar" }));

    const dialog = await screen.findByRole("dialog", { name: "Full Academic Calendar" });
    const today = within(dialog).getByRole("heading", { name: "Today and upcoming" });

    // It jumped to today's section, not the top of the past.
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(today);

    // Past events come before it in the page (scroll up to reach them); the rest follow it.
    const before = (node: HTMLElement) =>
      node.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING;
    const after = (node: HTMLElement) =>
      node.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_PRECEDING;
    expect(before(within(dialog).getByText("Orientation Week"))).toBeTruthy();
    expect(before(within(dialog).getByText("Midterm Exams"))).toBeTruthy();
    expect(after(within(dialog).getByText("Adjustment Period"))).toBeTruthy();
    expect(after(within(dialog).getByText("Enrollment Fair"))).toBeTruthy();
    expect(after(within(dialog).getByText("Foundation Day"))).toBeTruthy();
  });

  it("opens at today even when nothing is coming up, and says so", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    openHome({ events: [EVENTS[0]!, EVENTS[1]!] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Full Academic Calendar" }));

    const dialog = await screen.findByRole("dialog", { name: "Full Academic Calendar" });
    expect(within(dialog).getByRole("heading", { name: "Today and upcoming" })).toBeInTheDocument();
    expect(
      within(dialog).getByText("No upcoming events on the academic calendar."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Orientation Week")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("closes the calendar with Close and returns to the page", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    openHome({ events: EVENTS });
    const user = userEvent.setup();

    const button = await screen.findByRole("button", { name: "Full Academic Calendar" });
    await user.click(button);
    await user.click(
      within(await screen.findByRole("dialog", { name: "Full Academic Calendar" })).getByRole(
        "button",
        { name: "Close" },
      ),
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(button).toHaveFocus();
  });
});

describe("320px layout", () => {
  // jsdom does no layout, so it cannot measure overflow. What it can check is that every block
  // that holds text from the API is allowed to shrink and wrap: with `min-w-0` and `break-words`
  // a long unbroken word wraps inside its box instead of pushing the page wider than the screen.
  const LONG_WORD = "Supercalifragilisticexpialidocious".repeat(4);

  it("lets long text from the API wrap in every section", async () => {
    openHome({
      student: { ...STUDENT, name: LONG_WORD, programme: LONG_WORD },
      holds: [{ ...HOLD, office: LONG_WORD, description: LONG_WORD }],
      announcements: [
        {
          id: "a1",
          title: LONG_WORD,
          body: LONG_WORD,
          category: "ACADEMIC",
          published_at: daysAgo(1),
          expires_at: null,
          is_pinned: false,
        },
      ],
      events: [event("e1", LONG_WORD, "2026-08-17")],
      recent_activity: [activity("r1", daysAgo(1), LONG_WORD)],
    });

    const wraps = (node: HTMLElement) => node.className.includes("break-words");
    const holdBanner = await screen.findByRole("alert");

    expect(wraps(within(holdBanner).getByText(`Hold from ${LONG_WORD}`))).toBe(true);
    expect(wraps(within(holdBanner).getByText(LONG_WORD))).toBe(true);
    expect(wraps(screen.getByRole("heading", { level: 1 }))).toBe(true);
    expect(wraps(screen.getByText(new RegExp(`^${LONG_WORD} · 3rd year`)))).toBe(true);
    expect(wraps(screen.getByRole("heading", { name: LONG_WORD, level: 3 }))).toBe(true);
    expect(wraps(screen.getByText(LONG_WORD, { selector: "article p" }))).toBe(true);
    expect(wraps(within(section("Events")).getByText(LONG_WORD))).toBe(true);
    expect(wraps(within(section("Recent Activity")).getByText(`${LONG_WORD}.`))).toBe(true);
  });
});
