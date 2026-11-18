import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createStudentProfileApi, PROFILE_UPDATE_KEYS, type ProfileUpdate } from "./student";

const api = createStudentProfileApi(createApiClient("http://api.test/api/v1"));

function respond(body: BodyInit | null, status = 200, headers: Record<string, string> = {}) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status, headers }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200) {
  return respond(JSON.stringify(body), status);
}

function call(fetchMock: ReturnType<typeof respond>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

const PROFILE = {
  studentId: "2021-00456-MN-0",
  avatarUrl: "/api/v1/student/profile/avatar/7b0f",
  petitionRoute: "/api/v1/student/petitions/record-correction",
  fields: {
    firstName: { value: "Juan", editable: false },
    middleName: { value: null, editable: false },
    yearLevel: { value: 3, editable: false },
    phone: { value: "09123456789", editable: true },
  },
  emergencyContacts: [],
};

const CONTACT = {
  id: "c1",
  name: "Maria Dela Cruz",
  relationship: "Mother",
  phone: "09171234567",
  email: null,
  address: "",
  isPrimary: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("student profile api", () => {
  it("reads the profile with the bearer token and keeps each field's editability", async () => {
    const fetchMock = json(PROFILE);

    const profile = await api.get("tok");

    const { url, headers } = call(fetchMock);
    expect(url).toBe("http://api.test/api/v1/student/profile");
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(profile.studentId).toBe("2021-00456-MN-0");
    expect(profile.fields.middleName).toEqual({ value: null, editable: false });
    expect(profile.fields.yearLevel?.value).toBe("3");
    expect(profile.fields.phone).toEqual({ value: "09123456789", editable: true });
  });

  it("fails at the boundary when the profile's shape drifts", async () => {
    json({ ...PROFILE, fields: { phone: { value: "x" } } });

    await expect(api.get("tok")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("patches only the fields it is given", async () => {
    const fetchMock = json(PROFILE);

    await api.update("tok", { phone: "09123456789" });

    const { init } = call(fetchMock);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ phone: "09123456789" });
  });

  it("sends only the four profile keys the API takes, whatever else the caller passes", async () => {
    const fetchMock = json(PROFILE);

    await api.update("tok", {
      phone: "09123456789",
      emailAddress: "juan@example.com",
      permanentAddress: "123 Mabini St., Brgy. 630, Manila, Metro Manila",
      currentAddress: "9 Quezon Ave., Brgy. 630, Manila, Metro Manila",
      // Old names a stale caller might still send; none may reach the wire.
      mailingAddress: "x",
      personalEmail: "x",
      phoneNumber: "x",
    } as ProfileUpdate);

    const body = JSON.parse(String(call(fetchMock).init.body)) as Record<string, string>;
    expect(Object.keys(body)).toEqual([...PROFILE_UPDATE_KEYS]);
  });

  it("sends only the six contact keys the API takes, on create and on update", async () => {
    const stray = { ...CONTACT, address: null, fullName: "x", phoneNumber: "x" };
    const sixKeys = ["address", "email", "isPrimary", "name", "phone", "relationship"];

    let fetchMock = json(CONTACT, 201);
    await api.createContact("tok", stray);
    expect(Object.keys(JSON.parse(String(call(fetchMock).init.body))).sort()).toEqual(sixKeys);

    fetchMock = json(CONTACT);
    await api.updateContact("tok", "c1", stray);
    expect(Object.keys(JSON.parse(String(call(fetchMock).init.body))).sort()).toEqual(sixKeys);
  });

  it("uploads the picture as multipart, leaving the boundary to the browser", async () => {
    const fetchMock = json({ avatarUrl: "/api/v1/student/profile/avatar/9", url: "x" }, 201);

    const url = await api.uploadAvatar("tok", new Blob(["\xff\xd8\xff"], { type: "image/jpeg" }));

    const { init, headers } = call(fetchMock);
    expect(url).toBe("/api/v1/student/profile/avatar/9");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(Blob);
    expect(headers.get("Content-Type")).toBeNull();
  });

  it("loads the picture from the path the API named, under the client's own base URL", async () => {
    const fetchMock = respond(new Blob(["png"], { type: "image/png" }), 200, {
      "Content-Type": "image/png",
    });

    const blob = await api.avatar("tok", "/api/v1/student/profile/avatar/7b0f");

    const { url, headers } = call(fetchMock);
    expect(url).toBe("http://api.test/api/v1/student/profile/avatar/7b0f");
    expect(headers.get("Authorization")).toBe("Bearer tok");
    expect(blob.size).toBe(3);
  });

  it("answers another student's picture as a not-found ApiError", async () => {
    json({ detail: "Not found", code: "RESOURCE_NOT_FOUND" }, 404);

    const error: unknown = await api
      .avatar("tok", "/api/v1/student/profile/avatar/x")
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "RESOURCE_NOT_FOUND" });
  });

  it("reads contacts with an unset email or address as null", async () => {
    json([CONTACT]);

    const [contact] = await api.contacts("tok");

    expect(contact).toEqual({ ...CONTACT, email: null, address: null });
  });

  it("creates, updates, and deletes a contact at its own path", async () => {
    const input = { ...CONTACT, address: null } as const;
    let fetchMock = json(CONTACT, 201);
    await api.createContact("tok", input);
    expect(call(fetchMock).url).toBe("http://api.test/api/v1/student/profile/emergency-contacts");
    expect(call(fetchMock).init.method).toBe("POST");

    fetchMock = json(CONTACT);
    await api.updateContact("tok", "c1", input);
    expect(call(fetchMock).url).toBe(
      "http://api.test/api/v1/student/profile/emergency-contacts/c1",
    );
    expect(call(fetchMock).init.method).toBe("PATCH");

    fetchMock = respond(null, 204);
    await api.deleteContact("tok", "c1");
    expect(call(fetchMock).init.method).toBe("DELETE");
  });
});
