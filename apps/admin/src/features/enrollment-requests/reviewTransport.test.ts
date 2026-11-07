import { mockApi } from "@cbpupsis/account/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { refreshedPair, REFRESH_ROUTE, signInDirectly } from "../../test/fixtures";
import { enrollmentReviewDataSource as source } from "./dataSource";
import { createMockRequests } from "./mockData";
import { reviewFailure, reviewLoadError } from "./reviewErrors";

const wire = createMockRequests();
const signal = new AbortController().signal;
const addDropRow = wire.addDrop[0];

function waiverPage(offset: number, count: number, total: number) {
  const items = Array.from({ length: count }, (_, index) => ({
    ...wire.waivers.items[0],
    waiverRequestId: `waiver-${offset + index}`,
  }));
  return { status: 200, body: { items, total, limit: 200, offset } };
}

async function failure(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error("expected a rejection");
    },
    (reason: unknown) => reason,
  );
}

beforeEach(() => signInDirectly());
afterEach(async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("Enrollment review over the real API", () => {
  it("AC-ENRL-004.1: lists through the signed-in session and is not a mock source", async () => {
    const api = mockApi({ "GET /admin/add-drop": { status: 200, body: wire.addDrop } });

    const list = await source.list("add-drop", signal);

    expect(source.isMock).toBe(false);
    expect(list.total).toBe(wire.addDrop.length);
    expect(api.called("GET /admin/add-drop")[0].authorization).toBe("Bearer access-1");
  });

  it("AC-ENRL-004.1: an expired token refreshes once and the call retries", async () => {
    const api = mockApi({
      "GET /admin/overload-requests": [
        { status: 401, body: { detail: "Token expired" } },
        { status: 200, body: wire.overload },
      ],
      [REFRESH_ROUTE]: { status: 200, body: refreshedPair },
    });

    await source.list("overload", signal);

    expect(api.called(REFRESH_ROUTE)).toHaveLength(1);
    expect(api.called("GET /admin/overload-requests")[1].authorization).toBe("Bearer access-2");
  });

  it("AC-ENRL-004.1: follows every waiver page until the total", async () => {
    const seen: string[] = [];
    const replies = [waiverPage(0, 200, 205), waiverPage(200, 5, 205)];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(new URL(url).search);
        const reply = replies.shift()!;
        return new Response(JSON.stringify(reply.body), { status: reply.status });
      }),
    );

    const list = await source.list("waivers", signal);

    expect(seen).toEqual(["?limit=200&offset=0", "?limit=200&offset=200"]);
    expect(list.total).toBe(205);
    expect(list.items).toHaveLength(205);
  });

  it("AC-ENRL-004.1: an incomplete waiver sequence fails instead of showing a partial list", async () => {
    mockApi({ "GET /admin/waiver-requests": waiverPage(0, 200, 205) });

    await expect(source.list("waivers", signal)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("AC-ENRL-004.2: sends the add/drop body and maps the updated row", async () => {
    const body = { decision: "APPROVE", version: 1 } as const;
    const route = `PATCH /admin/add-drop/${addDropRow.requestId}`;
    const api = mockApi({
      [route]: { status: 200, body: { ...addDropRow, state: "APPROVED", version: 2 } },
    });

    const updated = await source.decide({
      kind: "add-drop",
      requestId: addDropRow.requestId,
      body,
    });

    expect(api.called(route)[0].body).toEqual(body);
    expect(updated).toMatchObject({ state: "APPROVED", version: 2 });
  });

  it("AC-ENRL-004.6: passes the backend code through, including the version conflict", async () => {
    mockApi({
      [`PATCH /admin/add-drop/${addDropRow.requestId}`]: {
        status: 409,
        body: {
          status: "error",
          message: "Request concurrency conflict. Please refresh and try again.",
          detail: "Request concurrency conflict. Please refresh and try again.",
          request_id: "req-9",
          code: "REQUEST_CONCURRENCY_CONFLICT",
        },
      },
    });

    const error = await failure(
      source.decide({
        kind: "add-drop",
        requestId: addDropRow.requestId,
        body: { decision: "APPROVE", version: 1 },
      }),
    );

    expect(error).toMatchObject({ status: 409, code: "REQUEST_CONCURRENCY_CONFLICT" });
    expect(reviewFailure(error).message).toContain("changed while you were reviewing");
    expect(reviewFailure(error).requestId).toBe("req-9");
  });

  it("AC-ENRL-004.11: a permission 403 with no code reads as an access problem", async () => {
    mockApi({
      "GET /admin/add-drop": {
        status: 403,
        body: {
          status: "error",
          message: "Missing required permission(s): ['ReadAddDropRequest']",
          detail: "Missing required permission(s): ['ReadAddDropRequest']",
          request_id: "req-3",
        },
      },
    });

    const error = await failure(source.list("add-drop", signal));

    expect(error).toMatchObject({ status: 403, code: undefined });
    expect(reviewFailure(error).message).toContain("no longer have permission");
    expect(reviewLoadError(error)).toMatchObject({
      detail: "Your account does not have access to these requests.",
      requestId: "req-3",
    });
  });
});
