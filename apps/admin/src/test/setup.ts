import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom has no scrolling; the router calls it on every navigation.
window.scrollTo = () => {};

// Account and page queries resolve independently; allow slower CI workers to render them.
configure({ asyncUtilTimeout: 3000 });
