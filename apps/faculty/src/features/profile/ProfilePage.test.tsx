import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { session } from "../../lib/auth";
import { renderFaculty } from "../../test/renderFaculty";

const profile = {
  petitionRoute: "/api/v1/faculty/petitions/record-correction",
  fields: {
    fullName: { value: "Prof. Maria Santos", editable: false },
    employeeId: { value: "EMP-01", editable: false },
    department: { value: "Computer Science", editable: false },
    title: { value: "Professor", editable: true },
    officeLocation: { value: "Main 201", editable: true },
    officeHours: { value: "Monday 10–12", editable: true },
    qualifications: { value: "MS Computer Science", editable: true },
  },
};
const preference = {
  notification_type: "roster.updated",
  channel: "email",
  enabled: true,
  editable: true,
};
const defaults = {
  "GET /faculty/profile": { status: 200, body: profile },
  "GET /notifications/preferences": {
    status: 200,
    body: [preference, { ...preference, notification_type: "security.notice", editable: false }],
  },
  "GET /auth/password-policy": {
    status: 200,
    body: { minimumLength: 12, requiredRules: ["uppercase", "lowercase", "digit", "symbol"] },
  },
};
beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null));
afterEach(async () => {
  cleanup();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function open(overrides: Parameters<typeof renderFaculty>[1] = {}) {
  const view = renderFaculty("/profile", { ...defaults, ...overrides });
  await screen.findByLabelText("Title / rank");
  await screen.findByLabelText("New password");
  return { ...view, user: userEvent.setup() };
}
it("AC-FAC-005.1/.3: displays every returned profile field and marks master fields Locked", async () => {
  await open();
  expect(screen.getByLabelText("Full name")).toHaveAttribute("readonly");
  expect(screen.getByLabelText("Employee ID")).toHaveValue("EMP-01");
  expect(screen.getByLabelText("Department")).toHaveAttribute("readonly");
  expect(screen.getAllByText(/Locked · Contact the Registrar/)).toHaveLength(3);
  expect(screen.getByLabelText("Qualifications")).toHaveValue("MS Computer Science");
});
it("AC-FAC-005.2: PATCH sends only changed editable fields and confirms saved values", async () => {
  const saved = {
    ...profile,
    fields: { ...profile.fields, title: { value: "Associate Professor", editable: true } },
  };
  const { user, called } = await open({ "PATCH /faculty/profile": { status: 200, body: saved } });
  const input = screen.getByLabelText("Title / rank");
  await user.clear(input);
  await user.type(input, "Associate Professor");
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText("Profile saved.");
  expect(called("PATCH /faculty/profile")[0]?.body).toEqual({ title: "Associate Professor" });
  expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
});
it.each([
  [
    422,
    { code: "VALIDATION_ERROR", details: { errors: { title: "Title is too long." } } },
    "Title is too long.",
  ],
  [
    403,
    { code: "PROFILE_FIELD_LOCKED", details: { lockedFields: ["title"] } },
    "These fields are locked: Title / rank.",
  ],
] as const)(
  "AC-FAC-005.2/.3: handles API field refusal %s beside the field",
  async (status, body, message) => {
    const { user } = await open({ "PATCH /faculty/profile": { status, body } });
    await user.type(screen.getByLabelText("Title / rank"), " updated");
    await user.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText(message);
  },
);
it("AC-FAC-005.4: saves one notification switch and reloads its effective state", async () => {
  const { user, called } = await open({
    "GET /notifications/preferences": [
      { status: 200, body: [preference] },
      { status: 200, body: [{ ...preference, enabled: false }] },
    ],
    "PUT /notifications/preferences": { status: 204 },
  });
  await user.click(await screen.findByRole("switch", { name: "Roster updated email" }));
  await screen.findByText("Notification preference saved.");
  expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  expect(called("PUT /notifications/preferences")[0]?.body).toEqual({
    notification_type: "roster.updated",
    channel: "email",
    enabled: false,
  });
});
it("AC-FAC-005.4: required notices cannot be turned off", async () => {
  await open();
  expect(screen.getByRole("switch", { name: "Security notice email" })).toBeDisabled();
});
it("AC-FAC-005.6: rules come from the API and confirmation blocks mismatched submission", async () => {
  const { user, called } = await open({
    "GET /auth/password-policy": {
      status: 200,
      body: { minimumLength: 16, requiredRules: ["uppercase", "digit"] },
    },
  });
  expect(screen.getByText(/At least 16 characters/)).toBeInTheDocument();
  expect(screen.queryByText(/A lowercase letter/)).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Current password"), "old-password");
  await user.type(screen.getByLabelText("New password"), "NewPassword123456");
  await user.type(screen.getByLabelText("Confirm new password"), "different");
  expect(screen.getByText("The passwords do not match.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Change password" })).toBeDisabled();
  expect(called("POST /auth/change-password")).toHaveLength(0);
});
async function submitPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Current password"), "CurrentPassword123!");
  await user.type(screen.getByLabelText("New password"), "NewPassword123!");
  await user.type(screen.getByLabelText("Confirm new password"), "NewPassword123!");
  await user.click(screen.getByRole("button", { name: "Change password" }));
}
it.each([
  [400, { code: "AUTH_CURRENT_PASSWORD_INCORRECT" }, "Your current password is incorrect."],
  [
    422,
    { code: "AUTH_PASSWORD_TOO_WEAK", unmet_rules: ["symbol"] },
    "Password does not meet these rules: symbol.",
  ],
  [423, { code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 60 }, /Try again in \d+ seconds/],
] as const)(
  "AC-FAC-005.5/.6: shows password refusal %s without resubmitting",
  async (status, body, message) => {
    const { user, called } = await open({ "POST /auth/change-password": { status, body } });
    await submitPassword(user);
    await screen.findByText(message);
    expect(called("POST /auth/change-password")).toHaveLength(1);
    if (status === 400)
      expect(screen.getByLabelText("Current password")).toHaveAttribute("aria-invalid", "true");
    if (status === 423)
      expect(screen.getByRole("button", { name: "Change password" })).toBeDisabled();
  },
);
it("AC-FAC-005.5: changes the password and keeps the replacement session", async () => {
  const { user } = await open({
    "POST /auth/change-password": {
      status: 200,
      body: { access_token: "replacement", refresh_token: "new-refresh" },
    },
  });
  await submitPassword(user);
  await screen.findByText("Password changed. Other devices are signed out.");
  expect(session.isSignedIn()).toBe(true);
  expect(screen.getByLabelText("New password")).toHaveValue("");
});
it("AC-FAC-005.1: failed profile reads offer a retry", async () => {
  renderFaculty("/profile", {
    ...defaults,
    "GET /faculty/profile": [{ status: 503 }, { status: 200, body: profile }],
  });
  await userEvent.click(await screen.findByRole("button", { name: "Retry profile" }));
  await screen.findByLabelText("Full name");
});
it("AC-FAC-005.1/.4/.6: account settings has no axe violations", async () => {
  const { container } = await open();
  await waitFor(() =>
    expect(screen.getByRole("switch", { name: "Roster updated email" })).toBeInTheDocument(),
  );
  expect((await axe.run(container)).violations).toEqual([]);
});

it("AC-FAC-005.1/.5: profile permission denial leaves password and notification settings accessible", async () => {
  const view = renderFaculty("/profile", {
    ...defaults,
    "GET /faculty/profile": { status: 403, body: { code: "PERMISSION_DENIED" } },
  });
  await screen.findByText(/Contact your administrator to restore profile access/);
  expect(await screen.findByLabelText("New password")).toBeInTheDocument();
  expect(await screen.findByRole("switch", { name: "Roster updated email" })).toBeInTheDocument();
  expect(view.called("PATCH /faculty/profile")).toHaveLength(0);
});
it("AC-FAC-005.2: missing update permission is explained without replaying the save", async () => {
  const { user, called } = await open({
    "PATCH /faculty/profile": { status: 403, body: { code: "PERMISSION_DENIED" } },
  });
  await user.type(screen.getByLabelText("Title / rank"), " updated");
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await screen.findByText(/Contact your administrator to restore editing access/);
  expect(called("PATCH /faculty/profile")).toHaveLength(1);
});
it("navigates from account settings back to Dashboard through its own sidebar link", async () => {
  const { user, router } = await open();
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  await user.click(screen.getByRole("link", { name: "Dashboard" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
});
