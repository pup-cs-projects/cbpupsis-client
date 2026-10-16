import { vi } from "vitest";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

/**
 * Stub `fetch` at the network boundary with replies keyed by "METHOD /path" (path relative to
 * /api/v1). A route may list several replies, used in order and the last one repeating.
 * Unrouted calls fail the test loudly instead of hanging.
 */
export function mockApi(routes: Record<string, Reply | Reply[]>) {
  const calls: { route: string; body: unknown; authorization: string | null }[] = [];
  const used = new Map<string, number>();

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const path = new URL(input).pathname.replace(/^\/api\/v1/, "");
      const route = `${init.method ?? "GET"} ${path}`;
      calls.push({
        route,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
        authorization: new Headers(init.headers).get("Authorization"),
      });
      const configured = routes[route];
      if (!configured) throw new Error(`Unexpected API call: ${route}`);
      const replies = Array.isArray(configured) ? configured : [configured];
      const index = used.get(route) ?? 0;
      used.set(route, index + 1);
      const reply = replies[Math.min(index, replies.length - 1)];
      return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
        status: reply.status,
        headers: reply.headers,
      });
    }),
  );

  return { calls, called: (route: string) => calls.filter((call) => call.route === route) };
}
