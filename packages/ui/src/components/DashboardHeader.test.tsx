import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardLayout } from "./DashboardLayout";

afterEach(() => {
  cleanup();
  localStorage.clear();
});
function header(onNavigate = vi.fn()) {
  return (
    <DashboardHeader
      name="Maria Santos"
      email="faculty@example.com"
      identifier="EMP-01"
      profileLink={(className, children) => (
        <a href="/profile" className={className}>
          {children}
        </a>
      )}
      passwordLink={(className, children) => (
        <a href="/profile#password" className={className}>
          {children}
        </a>
      )}
      notificationsLink={(className, children) => (
        <a href="/notifications" className={className}>
          {children}
        </a>
      )}
      signOut={<button>Logout</button>}
      items={[
        {
          label: "Grade Submission",
          content: (
            <a
              href="/grades"
              onClick={(event) => {
                event.preventDefault();
                onNavigate();
              }}
            >
              Grade Submission
            </a>
          ),
        },
        { label: "Profile", content: <a href="/profile">Profile</a> },
      ]}
    />
  );
}
it("opens the account disclosure, shows the real identity, and returns focus on Escape", async () => {
  render(header());
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: "Account menu for Maria Santos" });
  expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  await user.click(trigger);
  expect(screen.getByText("faculty@example.com")).toBeInTheDocument();
  expect(screen.getByText("EMP-01")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
  await user.keyboard("{Tab}{Escape}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});
it("filters portal pages and follows the first result using Enter", async () => {
  const navigate = vi.fn();
  render(header(navigate));
  const user = userEvent.setup();
  await user.type(screen.getByRole("searchbox", { name: "Search pages" }), "grade");
  expect(screen.getByText("1 pages found")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  await user.keyboard("{Enter}");
  expect(navigate).toHaveBeenCalledOnce();
  expect(screen.getByRole("searchbox")).toHaveValue("");
});
it("separates Dashboard navigation from the sidebar toggle and keeps it reachable when collapsed", async () => {
  render(
    <DashboardLayout
      portal="Faculty"
      navigation={[]}
      account={null}
      homeLink={(className, children) => (
        <a href="/dashboard" className={className}>
          {children}
        </a>
      )}
    >
      Page
    </DashboardLayout>,
  );
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
  await userEvent.click(screen.getByRole("button", { name: "Collapse menu" }));
  expect(screen.getByRole("button", { name: "Expand menu" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
});
