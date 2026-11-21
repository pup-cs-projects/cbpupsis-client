import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { account } from "../lib/auth";
import { me, signInDirectly } from "./fixtures";

export function renderGrading(page: ReactNode, path = "/sections/section-1/grades") {
  signInDirectly();
  mockApi({
    "GET /auth/faculty/me": { status: 200, body: me },
    "GET /users/me": { status: 200, body: { full_name: "Prof. Maria Santos", email: me.email } },
    "POST /auth/faculty/logout": { status: 204 },
  });
  const router = createPortalRouter({
    config: account,
    signIn: () => <p>Sign in</p>,
    dashboard: () => <p>Dashboard</p>,
    history: createMemoryHistory({ initialEntries: [path] }),
    extraRoutes: (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/sections/$sectionId/grades",
        component: () => page,
      }),
      createRoute({ getParentRoute: () => root, path: "/incompletes", component: () => page }),
      createRoute({
        getParentRoute: () => root,
        path: "/grades",
        component: () => <p>Section selection</p>,
      }),
    ],
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    client,
    router,
  };
}

export function installGradingDialogDom() {
  const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });
  return () => {
    for (const [name, descriptor] of [
      ["showModal", showModal],
      ["close", close],
    ] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  };
}
