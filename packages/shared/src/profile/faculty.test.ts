import { expect, it, vi } from "vitest";
import type { ApiClient } from "../api/client";
import { createFacultyProfileApi } from "./faculty";

function http() {
  return { request: vi.fn<ApiClient["request"]>(), requestBlob: vi.fn<ApiClient["requestBlob"]>() };
}
const profile = {
  petitionRoute: "/api/v1/faculty/petitions/record-correction",
  fields: { fullName: { value: "Ana", editable: false }, title: { value: null, editable: true } },
};
it("AC-FAC-005.1/.2/.3: reads editability and sends the editable changes to the faculty profile route", async () => {
  const client = http();
  client.request.mockResolvedValue(profile);
  const api = createFacultyProfileApi(client);
  expect(await api.get("access")).toEqual(profile);
  await api.update("access", { title: "Professor" });
  expect(client.request.mock.calls[1]).toEqual([
    "/faculty/profile",
    { method: "PATCH", body: { title: "Professor" }, accessToken: "access" },
  ]);
});
it("AC-FAC-005.4: sends one preference with the backend's field names and accepts its 204 response", async () => {
  const client = http();
  client.request
    .mockResolvedValueOnce([
      { notification_type: "roster.updated", channel: "in_app", enabled: true, editable: true },
    ])
    .mockResolvedValueOnce(undefined);
  const api = createFacultyProfileApi(client);
  const [pref] = await api.preferences("access");
  await api.setPreference("access", { ...pref!, enabled: false });
  expect(client.request.mock.calls[1]?.[1]?.body).toEqual({
    notification_type: "roster.updated",
    channel: "in_app",
    enabled: false,
  });
});
it("AC-FAC-005.1: rejects malformed field editability instead of making a locked field editable", async () => {
  const client = http();
  client.request.mockResolvedValue({
    ...profile,
    fields: { title: { value: "Professor", editable: "yes" } },
  });
  await expect(createFacultyProfileApi(client).get("access")).rejects.toHaveProperty(
    "code",
    "INVALID_RESPONSE",
  );
});
