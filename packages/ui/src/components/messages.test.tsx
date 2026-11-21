import "@testing-library/jest-dom/vitest";
import { ApiError } from "@cbpupsis/shared/api";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorAlert, Notice, TOAST_DISMISS_MS } from "./messages";

const refused = (detail: string, requestId?: string) =>
  new ApiError(401, "AUTH_FAILED", { detail, requestId });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("toasts", () => {
  it("render into the one region at the end of the page, outside the screen that raised them", () => {
    const { container } = render(
      <div>
        <ErrorAlert error={refused("Invalid employee ID or password.")} />
        <Notice>Your password has been changed.</Notice>
      </div>,
    );

    const region = document.getElementById("cbpupsis-toasts");
    expect(region?.parentElement).toBe(document.body);
    expect(document.body.lastElementChild).toBe(region);
    expect(container.firstElementChild).toBeEmptyDOMElement();
    expect(region).toContainElement(screen.getByRole("alert"));
    expect(region).toContainElement(screen.getByRole("status"));
  });

  it("show the API's own words as the message, under a generic title", () => {
    render(<ErrorAlert error={refused("Invalid employee ID or password.", "req-1")} />);

    const alert = screen.getByRole("alert");
    expect(screen.getByText("Invalid employee ID or password.")).toHaveClass("toast-message");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("req-1");
  });

  it("title each tone by default, and take a title when given one", () => {
    render(
      <>
        <Notice>Sent.</Notice>
        <Notice tone="success">Saved.</Notice>
        <ErrorAlert error={refused("No.")} title="Sign-in failed" />
      </>,
    );

    const titles = [...document.querySelectorAll(".toast-title")].map((node) => node.textContent);
    expect(titles).toEqual(["Notice", "Done", "Sign-in failed"]);
  });

  it("hide on Dismiss, stay hidden for the same error, and show again for a new one", () => {
    const first = refused("Invalid employee ID or password.");
    const { rerender } = render(<ErrorAlert error={first} />);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<ErrorAlert error={first} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // A second failed attempt is a new error, even in the same words.
    rerender(<ErrorAlert error={refused("Invalid employee ID or password.")} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid employee ID or password.");
  });

  it("never take an error away on their own", () => {
    vi.useFakeTimers();
    render(<ErrorAlert error={refused("Account temporarily locked.")} />);

    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS * 10));

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("take a notice away after 8 seconds, but not while it is hovered", () => {
    vi.useFakeTimers();
    render(<Notice tone="success">Your new password is set.</Notice>);
    const toast = screen.getByRole("status").closest(".toast");
    if (!(toast instanceof HTMLElement)) throw new Error("no toast");

    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS / 2));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS * 2));
    expect(screen.getByRole("status")).toHaveTextContent("Your new password is set.");

    // Leaving resumes the clock where it stopped.
    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(TOAST_DISMISS_MS / 2 - 1));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("speak one prefix: a notice's sentence says Notice, an error relies on its title", () => {
    render(
      <>
        <Notice>Sent.</Notice>
        <ErrorAlert error={refused("No.")} />
      </>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Notice: Sent.");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Error:");
  });

  it("stay in the flow when placed inline, for a modal dialog", () => {
    const { container } = render(<ErrorAlert error={refused("No.")} placement="inline" />);

    expect(container).toContainElement(screen.getByRole("alert"));
  });
});
