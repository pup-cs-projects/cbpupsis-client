import { describe, expect, it } from "vitest";

import { ApiError, fieldErrors } from "./errors";

describe("fieldErrors", () => {
  it("returns the API's reason for each field it named", () => {
    const error = new ApiError(422, "VALIDATION_ERROR", {
      detail: "Validation failed for phone, emailAddress",
      details: {
        fields: ["phone", "emailAddress"],
        errors: { phone: "Expected Philippine mobile format.", emailAddress: "Expected an email." },
      },
    });

    expect(fieldErrors(error)).toEqual({
      phone: "Expected Philippine mobile format.",
      emailAddress: "Expected an email.",
    });
  });

  it("is empty for errors that name no field", () => {
    expect(fieldErrors(new ApiError(500, undefined))).toEqual({});
    expect(
      fieldErrors(new ApiError(422, "VALIDATION_ERROR", { details: { errors: "bad" } })),
    ).toEqual({});
    expect(
      fieldErrors(new ApiError(422, "VALIDATION_ERROR", { details: { errors: ["bad"] } })),
    ).toEqual({});
    expect(fieldErrors(new Error("boom"))).toEqual({});
    expect(fieldErrors(null)).toEqual({});
  });

  it("skips reasons that are not text", () => {
    const error = new ApiError(422, "VALIDATION_ERROR", {
      details: { errors: { phone: "Bad.", email: 7, address: "" } },
    });

    expect(fieldErrors(error)).toEqual({ phone: "Bad." });
  });
});
