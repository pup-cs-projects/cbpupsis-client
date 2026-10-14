import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("names the product in the page's only top-level heading", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1, name: "CBPUPSIS" })).toBeInTheDocument();
  });
});
