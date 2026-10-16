import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacultyLoginPage } from "./FacultyLoginPage";
import { authApi, AuthError } from "../../lib/auth-api";
import { facultySessionKey } from "./useFacultyAuth";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("../../lib/auth-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/auth-api")>();
  return {
    ...actual,
    authApi: { login: vi.fn(), enroll: vi.fn(), confirmEnrollment: vi.fn(), verify: vi.fn() },
  };
});

let client: QueryClient;
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  vi.useRealTimers();
});
function mount() {
  return render(
    <QueryClientProvider client={client}>
      <FacultyLoginPage />
    </QueryClientProvider>,
  );
}
function fillCredentials() {
  fireEvent.change(screen.getByLabelText(/Faculty ID/), { target: { value: "2021-00456-MN-0" } });
  fireEvent.change(screen.getByLabelText("Birth month"), { target: { value: "02" } });
  fireEvent.change(screen.getByLabelText("Birth day"), { target: { value: "15" } });
  fireEvent.change(screen.getByLabelText("Birth year"), { target: { value: "1980" } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "test-password" } });
}
async function challenge(enrollmentRequired = false, expiresAt = Date.now() + 300_000) {
  vi.mocked(authApi.login).mockResolvedValue({
    kind: "challenge",
    challengeToken: "test-challenge",
    enrollmentRequired,
    expiresAt,
  });
  mount();
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "Sign in to Portal" }));
  await screen.findByRole("heading", {
    name: enrollmentRequired ? "Secure your account" : "Two-step verification",
  });
}
function enterCode() {
  fireEvent.change(screen.getByLabelText(/Authentication code/), { target: { value: "123456" } });
}

describe("faculty sign-in", () => {
  it("has labelled keyboard reachable fields and a password visibility toggle", async () => {
    mount();
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to sign in" })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/Faculty ID/)).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("rejects an impossible birth date before submitting", () => {
    mount();
    fillCredentials();
    fireEvent.change(screen.getByLabelText("Birth day"), { target: { value: "31" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in to Portal" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid date");
    expect(authApi.login).not.toHaveBeenCalled();
  });
  it("shows skeleton loading and prevents duplicate submission", async () => {
    vi.mocked(authApi.login).mockReturnValue(new Promise(() => {}));
    mount();
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in to Portal" }));
    expect(await screen.findByRole("status", { name: /Please wait/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to Portal" })).toBeDisabled();
  });
  it("does not create a session after the password step", async () => {
    await challenge();
    expect(client.getQueryData(facultySessionKey)).toBeUndefined();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Two-step verification" })).toHaveFocus();
  });
  it("opens the faculty dashboard only after successful verification", async () => {
    await challenge();
    vi.mocked(authApi.verify).mockResolvedValue({
      kind: "session",
      role: "faculty",
      accessToken: "test-session",
      expiresAt: Date.now() + 1800_000,
    });
    enterCode();
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" }));
    expect(client.getQueryData(facultySessionKey)).toMatchObject({ role: "faculty" });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
  it.each(["AUTH_FAILED", "AUTH_MFA_CODE_REUSED"])(
    "announces a generic error for %s without a session",
    async (code) => {
      await challenge();
      vi.mocked(authApi.verify).mockRejectedValue(new AuthError(code, "request-123"));
      enterCode();
      fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Unable to sign in with the details provided",
      );
      expect(screen.getByRole("alert")).toHaveTextContent("request-123");
      expect(client.getQueryData(facultySessionKey)).toBeUndefined();
    },
  );
  it("displays lockout timing and enables retry when the server waiting period ends", async () => {
    await challenge();
    vi.mocked(authApi.verify).mockRejectedValue(
      new AuthError("AUTH_ACCOUNT_LOCKED", undefined, Date.now() + 3000),
    );
    enterCode();
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText(/Authentication code/)).toBeDisabled();
    expect(screen.getByRole("timer", { name: "Time before retry" })).toBeInTheDocument();
    vi.useFakeTimers();
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByLabelText(/Authentication code/)).toBeEnabled(), {
      timeout: 5000,
    });
  });
  it("blocks an expired challenge and offers a fresh sign-in", async () => {
    await challenge(false, Date.now() - 1000);
    expect(screen.getByLabelText(/Authentication code/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByRole("heading", { name: "Faculty Portal" })).toBeInTheDocument();
  });
  it("keeps enrollment restricted until setup, recovery-code acknowledgement, and verification finish", async () => {
    await challenge(true);
    expect(screen.queryByLabelText(/Authentication code/)).not.toBeInTheDocument();
    vi.mocked(authApi.enroll).mockResolvedValue({
      secret: "TESTSECRET",
      accountName: "faculty-test",
      issuer: "PUP",
      period: 30,
    });
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    expect(await screen.findByLabelText("Setup key")).toHaveValue("TESTSECRET");
    vi.mocked(authApi.confirmEnrollment).mockResolvedValue(["TEST-1111", "TEST-2222"]);
    enterCode();
    fireEvent.click(screen.getByRole("button", { name: "Verify authenticator" }));
    expect(await screen.findByRole("list", { name: "Recovery codes" })).toHaveTextContent(
      "TEST-1111",
    );
    expect(client.getQueryData(facultySessionKey)).toBeUndefined();
    expect(authApi.verify).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Authentication code/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I have saved my recovery codes" }));
    expect(screen.getByLabelText(/Authentication code/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Setup key")).not.toBeInTheDocument();
  });
  it("offers retry when setup is unavailable", async () => {
    await challenge(true);
    vi.mocked(authApi.enroll).mockRejectedValue(new AuthError("SERVICE_UNAVAILABLE"));
    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to connect");
    expect(screen.getByRole("button", { name: "Retry authenticator setup" })).toBeEnabled();
  });
});
