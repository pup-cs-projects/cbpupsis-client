import { expect, it, vi } from "vitest";
import type { ApiClient } from "../api/client";
import { createFacultySectionsApi } from "./faculty";
const section = { id: "s1", section_name: "BSCS 2-1", capacity: 40, status: "open" };
function http() {
  return {
    request: vi.fn<ApiClient["request"]>(),
    requestBlob: vi.fn<ApiClient["requestBlob"]>().mockResolvedValue(new Blob(["CSV"])),
  };
}
it("AC-FAC-004.1/.2/.3/.5: uses role routes, the Page envelope and active filters for exports", async () => {
  const client = http();
  client.request
    .mockResolvedValueOnce({ items: [section], total: 21, limit: 20, offset: 20 })
    .mockResolvedValueOnce({ ...section, roster: [], total: 0, limit: 20, offset: 0 });
  const api = createFacultySectionsApi(client);
  expect((await api.sections("token", 20)).items[0]?.sectionName).toBe("BSCS 2-1");
  await api.roster("token", "s/1", { enrollmentStatus: "DROPPED", gradeStatus: "INC" });
  await api.exportCsv("token", "s/1", { gradeStatus: "INC" });
  expect(client.request.mock.calls.map(([path]) => path)).toEqual([
    "/faculty/sections?limit=20&offset=20",
    "/faculty/sections/s%2F1/roster?enrollmentStatus=DROPPED&gradeStatus=INC&limit=20&offset=0",
  ]);
  expect(client.requestBlob.mock.calls[0]?.[0]).toBe(
    "/faculty/sections/s%2F1/roster/export?gradeStatus=INC",
  );
});
it("AC-FAC-004.6: excludes private fields and uses the teaching-detail route", async () => {
  const client = http();
  client.request.mockResolvedValue({
    name: "Ana",
    studentNumber: "S-1",
    email: "a@example.com",
    program: "BSCS",
    yearLevel: 2,
    privateAddress: "secret",
  });
  const result = await createFacultySectionsApi(client).student("token", "s1", "u/1");
  expect(result).not.toHaveProperty("privateAddress");
  expect(client.request.mock.calls[0]?.[0]).toBe("/faculty/sections/s1/roster/u%2F1");
});
it("AC-FAC-004.1: rejects incompatible section responses rather than showing missing fields", async () => {
  const client = http();
  client.request.mockResolvedValue([section]);
  await expect(createFacultySectionsApi(client).sections("token")).rejects.toHaveProperty(
    "code",
    "INVALID_RESPONSE",
  );
});
