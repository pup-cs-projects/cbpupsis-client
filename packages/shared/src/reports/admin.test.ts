import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createAdminReportsApi, enrollmentReportQuery } from "./admin";

const api = createAdminReportsApi(createApiClient("http://api.test/api/v1"));
const termId = "30000000-0000-4000-8000-000000000001";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  const fetch = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("admin enrollment report API (US-RPT-001)", () => {
  it("AC-RPT-001.1: reads grouped counts and the total for a term", async () => {
    const fetch = stubFetch(
      Response.json({
        rows: [
          { group: "BSCS", count: 12 },
          { group: "BSIT", count: 8 },
        ],
        total: 20,
      }),
    );
    const report = await api.enrollment("token", {
      termId,
      programCode: " ",
      status: "enrolled",
      groupBy: "program",
    });
    expect(report).toEqual({
      rows: [
        { group: "BSCS", count: 12 },
        { group: "BSIT", count: 8 },
      ],
      total: 20,
    });
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe("/api/v1/admin/reports/enrollment");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      termId,
      groupBy: "program",
      status: "enrolled",
    });
  });

  it("AC-RPT-001.6: rejects a response that is not counts", async () => {
    stubFetch(Response.json({ rows: [{ group: "BSCS", count: "12" }], total: 12 }));
    await expect(api.enrollment("token", { termId, groupBy: "program" })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("AC-RPT-001.3: exports with the same filters and the chosen format", async () => {
    const fetch = stubFetch(new Response("group,count\n", { status: 200 }));
    const blob = await api.exportEnrollment(
      "token",
      { termId, programCode: "BSCS", groupBy: "yearLevel" },
      "pdf",
    );
    expect(await blob.text()).toBe("group,count\n");
    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.pathname).toBe("/api/v1/admin/reports/enrollment/export");
    expect(url.search).toBe(
      "?" +
        enrollmentReportQuery(
          { termId, programCode: "BSCS", groupBy: "yearLevel" },
          { format: "pdf" },
        ),
    );
    expect(url.searchParams.get("format")).toBe("pdf");
  });

  it("surfaces the API's error code", async () => {
    stubFetch(
      Response.json(
        { detail: "This action is not available to your role", code: "AUTH_INSUFFICIENT_ROLE" },
        { status: 403 },
      ),
    );
    const failure = await api.enrollment("token", { termId, groupBy: "program" }).catch((e) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 403, code: "AUTH_INSUFFICIENT_ROLE" });
  });
});
