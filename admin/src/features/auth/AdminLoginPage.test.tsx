import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLoginPage } from "./AdminLoginPage";
import { AdminDashboard, AccessError } from "./AdminDashboard";
import { AuthError } from "../../lib/auth-api";
import { adminSessionKey } from "./useAdminAuth";
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Navigate: () => <p>Return to sign in</p>,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
function mount(
  component = <AdminLoginPage />,
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
  return client;
}
function responses(...bodies: { body: unknown; status?: number }[]) {
  const fetcher = vi.fn();
  bodies.forEach(({ body, status = 200 }) =>
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(body), { status })),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
async function signIn() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/Administrator ID/), "admin");
  await user.type(screen.getByLabelText(/^Password/), "test-password");
  await user.click(screen.getByRole("button", { name: "Sign in to Portal" }));
}
const challenge = {
  mfa_required: true,
  mfa_enrolled: true,
  challenge_token: "test",
  expires_in: 300,
  methods: ["totp", "webauthn"],
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("administrator screens", () => {
  it("validates empty fields accessibly", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Sign in to Portal" }));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByLabelText(/Administrator ID/)).toHaveAttribute("aria-invalid", "true");
  });
  it("shows a skeleton while credentials are being checked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    mount();
    await signIn();
    expect(screen.getByRole("status", { name: /Please wait/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to Portal" })).toBeDisabled();
  });
  it("requires MFA before navigating and exposes the security-key option", async () => {
    responses({ body: challenge });
    mount();
    await signIn();
    expect(await screen.findByRole("heading", { name: "Two-step verification" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Use a security key" })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("keeps an invalid factor on the verification screen", async () => {
    responses({ body: challenge }, { body: { code: "AUTH_MFA_INVALID" }, status: 401 });
    mount();
    await signIn();
    await screen.findByLabelText(/Authentication code/);
    fireEvent.change(screen.getByLabelText(/Authentication code/), { target: { value: "123456" } });
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in");
    expect(navigate).not.toHaveBeenCalled();
  });
  it("opens only enrollment for an account without a factor", async () => {
    responses({ body: { ...challenge, mfa_enrolled: false } });
    mount();
    await signIn();
    expect(await screen.findByRole("button", { name: "Set up authenticator" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Use a security key" })).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
  it("announces lockout and disables retries using API time", async () => {
    responses({ body: { code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 900 }, status: 423 });
    mount();
    await signIn();
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in");
    expect(screen.getByRole("timer")).toHaveTextContent(/1[45]:[0-5][0-9]/);
    expect(screen.getByRole("button", { name: "Sign in to Portal" })).toBeDisabled();
  });
  it("grants navigation only after a verified admin session", async () => {
    responses(
      { body: challenge },
      {
        body: {
          role: "admin",
          position: "Chairperson",
          permissions: [],
          access_token: "test",
          expires_in: 600,
        },
      },
    );
    const client = mount();
    await signIn();
    await screen.findByLabelText(/Authentication code/);
    fireEvent.change(screen.getByLabelText(/Authentication code/), { target: { value: "123456" } });
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" }));
    expect(client.getQueryData(adminSessionKey)).toMatchObject({
      role: "admin",
      position: "Chairperson",
    });
  });
  it("does not disclose scope in a not-found response", () => {
    mount(<AccessError error={new AuthError("RESOURCE_NOT_FOUND")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Record not found");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/department|permission|college/i);
  });
  it("explains a role refusal and whom to contact", () => {
    mount(<AccessError error={new AuthError("AUTH_INSUFFICIENT_ROLE")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Contact ICTO");
  });
  it("hides functions without API permissions", () => {
    const client = new QueryClient();
    client.setQueryData(adminSessionKey, {
      role: "admin",
      position: "Registrar",
      permissions: ["students:read"],
      accessToken: "test",
      expiresAt: Date.now() + 60000,
    });
    mount(<AdminDashboard />, client);
    expect(screen.getByRole("link", { name: "Student records" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit ledger" })).not.toBeInTheDocument();
  });
  it("redirects an unauthenticated dashboard", () => {
    mount(<AdminDashboard />);
    expect(screen.getByText("Return to sign in")).toBeInTheDocument();
  });
});

describe("enrollment and expiration", () => {
  it("requires enrollment confirmation, saving recovery codes, and verification before entry", async () => {
    responses(
      { body: { ...challenge, mfa_enrolled: false } },
      {
        body: {
          provisioning_uri: "otpauth://totp/PUP:test?secret=TESTKEY&issuer=PUP",
          issuer: "PUP",
          account_name: "test",
        },
      },
      { body: { recovery_codes: ["test-recovery-code"] } },
      {
        body: {
          role: "admin",
          position: "Dean",
          permissions: [],
          access_token: "test",
          expires_in: 600,
        },
      },
    );
    mount();
    await signIn();
    await userEvent.click(await screen.findByRole("button", { name: "Set up authenticator" }));
    expect(await screen.findByLabelText("Setup key")).toHaveValue("TESTKEY");
    fireEvent.change(screen.getByLabelText(/Authentication code/), { target: { value: "123456" } });
    await userEvent.click(screen.getByRole("button", { name: "Verify authenticator" }));
    expect(await screen.findByText("test-recovery-code")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "I have saved my recovery codes" }));
    fireEvent.change(screen.getByLabelText(/Authentication code/), { target: { value: "654321" } });
    await userEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/dashboard" }));
  });
  it("expires challenges without allowing another factor submission", async () => {
    responses({ body: { ...challenge, expires_in: 0.01 } });
    mount();
    await signIn();
    await screen.findByRole("heading", { name: "Two-step verification" });
    await waitFor(
      () => expect(screen.getByRole("button", { name: "Use a security key" })).toBeDisabled(),
      { timeout: 2000 },
    );
    expect(screen.getByRole("button", { name: "Back to sign in" })).toBeEnabled();
  });
});
