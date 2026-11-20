import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../api/client";
import { createAdminReportsApi, type ReportFilters } from "./admin";
const root = "https://api.example.com/api/v1";
const filters: ReportFilters = {
  termId: "term-1",
  groupBy: "yearLevel",
  programCode: " BSCS ",
  status: "ENROLLED_PENDING",
};
afterEach(() => vi.unstubAllGlobals());
describe("US-RPT-001 report API contracts", () => {
  it("AC-RPT-001.1 / AC-RPT-001.3: reads and exports use identical filter and scope-free queries", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ rows: [{ group: "1", count: 2 }], total: 2 })),
      )
      .mockResolvedValueOnce(
        new Response("group,count\n1,2", { headers: { "Content-Type": "text/csv" } }),
      );
    vi.stubGlobal("fetch", fetch);
    const api = createAdminReportsApi(createApiClient(root));
    expect((await api.enrollment("token", filters)).total).toBe(2);
    await api.exportEnrollment("token", filters, "csv");
    const urls = fetch.mock.calls.map(([url]) => new URL(url));
    expect(urls[0]!.pathname).toBe("/api/v1/admin/reports/enrollment");
    expect(urls[1]!.pathname).toBe("/api/v1/admin/reports/enrollment/export");
    expect([...urls[0]!.searchParams]).toEqual([
      ["termId", "term-1"],
      ["groupBy", "yearLevel"],
      ["programCode", "BSCS"],
      ["status", "ENROLLED_PENDING"],
    ]);
    urls[1]!.searchParams.delete("format");
    expect(urls[0]!.search).toBe(urls[1]!.search);
    expect(new Headers(fetch.mock.calls[0]![1].headers).get("Authorization")).toBe("Bearer token");
    expect(fetch.mock.calls.every((call) => call[1].method === "GET")).toBe(true);
  });
  it.each([
    { rows: [{ group: "BSCS", count: -1 }], total: -1 },
    { rows: [{ group: "BSCS", count: 2 }], total: 3 },
    {
      rows: [
        { group: "BSCS", count: 1 },
        { group: "BSCS", count: 1 },
      ],
      total: 2,
    },
  ])("AC-RPT-001.1: refuses inconsistent or ambiguous report numbers (%j)", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(
      createAdminReportsApi(createApiClient(root)).enrollment("token", filters),
    ).rejects.toHaveProperty("code", "INVALID_RESPONSE");
  });
  it("AC-RPT-001.3: refuses a JSON error disguised as a successful download", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("{}", { headers: { "Content-Type": "application/json" } })),
    );
    await expect(
      createAdminReportsApi(createApiClient(root)).exportEnrollment("token", filters, "pdf"),
    ).rejects.toHaveProperty("code", "INVALID_RESPONSE");
  });
});
