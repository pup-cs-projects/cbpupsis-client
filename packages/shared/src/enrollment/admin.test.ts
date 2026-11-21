import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createAdminEnrollmentApi, type WaiverRead } from "./admin";

const api = createAdminEnrollmentApi(createApiClient("http://api.test/api/v1"));
const id = "10000000-0000-4000-8000-000000000001";

const person = {
  studentId: "20000000-0000-4000-8000-000000000001",
  studentNumber: "2023-00001-MN-0",
  studentName: "Sample Student",
  programCode: "BSCS",
  department: "Computer Science",
  college: null,
  term: "2026-1",
  createdAt: "2026-08-01T00:00:00Z",
};

const addDrop = {
  ...person,
  requestId: id,
  academicTermId: "30000000-0000-4000-8000-000000000001",
  state: "PENDING",
  unitsBefore: "21.0",
  unitsAfter: "18.0",
  comments: "",
  remarks: null,
  version: 3,
  courses: [
    {
      sectionId: "40000000-0000-4000-8000-000000000001",
      courseCode: "CS 101",
      courseTitle: "Programming",
      units: "3.0",
      tag: "PENDING_DROP",
      reason: null,
    },
  ],
  reviewedAt: null,
  reviewedBy: null,
};

const overload = {
  ...person,
  overloadRequestId: id,
  requestedUnits: 27,
  justification: "Graduating this term.",
  state: "PENDING_DEAN",
  reviewedBy: null,
  remarks: null,
  reviewedAt: null,
};

const waiver: WaiverRead = {
  waiverRequestId: id,
  state: "PENDING_CHAIR",
  studentId: person.studentId,
  sectionId: "40000000-0000-4000-8000-000000000001",
  prerequisiteCourseCode: "CS 100",
  condition: "GRADUATING",
  justification: "Graduating this term.",
  reviewRemarks: null,
  vpaaReference: null,
  createdAt: person.createdAt,
};

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sent(fetchMock: ReturnType<typeof respond>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    method: init.method,
    authorization: new Headers(init.headers).get("Authorization"),
    body: init.body === undefined ? undefined : (JSON.parse(String(init.body)) as unknown),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createAdminEnrollmentApi", () => {
  it.each([
    ["listAddDrop", "http://api.test/api/v1/admin/add-drop", [addDrop]],
    ["listOverload", "http://api.test/api/v1/admin/overload-requests", [overload]],
  ] as const)("%s reads %s with the bearer token", async (method, url, reply) => {
    const fetchMock = respond(200, reply);

    await expect(api[method]("token")).resolves.toEqual(reply);

    expect(sent(fetchMock)).toEqual({
      url,
      method: "GET",
      authorization: "Bearer token",
      body: undefined,
    });
  });

  it("listWaivers sends limit and offset and returns the page", async () => {
    const page = { items: [waiver], total: 201, limit: 200, offset: 200 };
    const fetchMock = respond(200, page);

    await expect(api.listWaivers("token", { limit: 200, offset: 200 })).resolves.toEqual(page);

    expect(sent(fetchMock)).toMatchObject({
      url: "http://api.test/api/v1/admin/waiver-requests?limit=200&offset=200",
      method: "GET",
    });
  });

  it("decideAddDrop patches decision, remarks and version", async () => {
    const fetchMock = respond(200, addDrop);
    const body = { decision: "REJECT", remarks: "Conflict.", version: 3 } as const;

    await api.decideAddDrop("token", id, body);

    expect(sent(fetchMock)).toEqual({
      url: `http://api.test/api/v1/admin/add-drop/${id}`,
      method: "PATCH",
      authorization: "Bearer token",
      body,
    });
  });

  it("decideOverload patches decision and remarks", async () => {
    const fetchMock = respond(200, overload);
    const body = { decision: "APPROVE", remarks: "Approved." } as const;

    await api.decideOverload("token", id, body);

    expect(sent(fetchMock)).toEqual({
      url: `http://api.test/api/v1/admin/overload-requests/${id}`,
      method: "PATCH",
      authorization: "Bearer token",
      body,
    });
  });

  it("decideWaiver patches decision, remarks and vpaaReference", async () => {
    const fetchMock = respond(200, waiver);
    const body = { decision: "APPROVE", remarks: "Noted.", vpaaReference: "VPAA-1" } as const;

    await api.decideWaiver("token", id, body);

    expect(sent(fetchMock)).toEqual({
      url: `http://api.test/api/v1/admin/waiver-requests/${id}`,
      method: "PATCH",
      authorization: "Bearer token",
      body,
    });
  });

  it("keeps the API's code, detail and request id on a refusal", async () => {
    respond(409, {
      status: "error",
      message: "Already decided.",
      detail: "Already decided.",
      request_id: "req-1",
      code: "REQUEST_ALREADY_DECIDED",
    });

    const error = await api
      .decideOverload("token", id, { decision: "APPROVE" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: "REQUEST_ALREADY_DECIDED",
      detail: "Already decided.",
      requestId: "req-1",
    });
  });

  it("accepts the defaults the schema allows to be left out", async () => {
    respond(200, [{ ...addDrop, version: undefined, courses: undefined, comments: undefined }]);

    const [row] = await api.listAddDrop("token");

    expect(row.version).toBeUndefined();
    expect(row.courses).toBeUndefined();
  });

  it.each([
    ["an unknown add/drop state", () => api.listAddDrop("t"), [{ ...addDrop, state: "OPEN" }]],
    ["a missing nullable field", () => api.listAddDrop("t"), [{ ...addDrop, college: undefined }]],
    ["non-integer units", () => api.listOverload("t"), [{ ...overload, requestedUnits: "27" }]],
    ["a bare list for waivers", () => api.listWaivers("t", { limit: 1, offset: 0 }), [waiver]],
  ])("refuses %s as INVALID_RESPONSE", async (_name, call, reply) => {
    respond(200, reply);

    await expect(call()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
