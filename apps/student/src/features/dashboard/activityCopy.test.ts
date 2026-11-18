import { describe, expect, it } from "vitest";

import { humanizeActivity, humanizeKey } from "./activityCopy";

describe("humanizeKey", () => {
  it.each([
    ["emergency_contact.created", "Emergency contact added."],
    ["emergency_contact.updated", "Emergency contact updated."],
    ["emergency_contact.deleted", "Emergency contact removed."],
    ["profile.updated", "Profile updated."],
    ["payment.submitted", "Payment submitted."],
    ["password.changed", "Password changed."],
    // No known verb: spelled out, never left as a key.
    ["foo_bar.baz", "Foo bar baz."],
    ["profile_photo", "Profile photo."],
  ])("%s → %s", (key, expected) => {
    expect(humanizeKey(key)).toBe(expected);
  });
});

describe("humanizeActivity", () => {
  it("turns a failed sign-in's error code into plain words", () => {
    expect(
      humanizeActivity({ type: "LOGIN_FAILED", description: "Login attempt failed. AUTH_FAILED" }),
    ).toBe("Sign-in attempt failed");
    expect(
      humanizeActivity({
        type: "AUDIT",
        description: "Sign-in rejected: AUTH_INVALID_CREDENTIALS",
      }),
    ).toBe("Sign-in attempt failed");
    // The type alone is enough when the text carries no code.
    expect(humanizeActivity({ type: "LOGIN_FAILED", description: "Failed sign-in attempt" })).toBe(
      "Sign-in attempt failed",
    );
  });

  it("turns an action sentence into copy a student can read", () => {
    expect(
      humanizeActivity({
        type: "AUDIT",
        description: "Action emergency_contact.created completed.",
      }),
    ).toBe("Emergency contact added.");
    expect(
      humanizeActivity({ type: "AUDIT", description: "Action profile.updated completed." }),
    ).toBe("Profile updated.");
    expect(
      humanizeActivity({ type: "AUDIT", description: "Action payment.submitted completed." }),
    ).toBe("Payment submitted.");
  });

  it("spells out a key inside a longer sentence, and leaves ordinary words alone", () => {
    expect(humanizeActivity({ type: "AUDIT", description: "Saved your profile_photo." })).toBe(
      "Saved your profile photo.",
    );
    expect(
      humanizeActivity({
        type: "ENROLLMENT",
        description: "Successfully enrolled for Summer Term AY 2025–2026.",
      }),
    ).toBe("Successfully enrolled for Summer Term AY 2025–2026.");
    expect(humanizeActivity({ type: "AUDIT", description: "Uploaded report.pdf" })).toBe(
      "Uploaded report.pdf.",
    );
  });

  it("falls back to the type when the text has nothing readable left", () => {
    expect(humanizeActivity({ type: "LOGIN_SUCCESS", description: "LOGIN_OK" })).toBe(
      "Signed in successfully.",
    );
    expect(humanizeActivity({ type: "SOMETHING_ODD", description: "ODD_CODE" })).toBe(
      "Something odd.",
    );
    expect(humanizeActivity({ type: "", description: "ODD_CODE" })).toBe("Account activity.");
  });

  it("never lets an enum code or an event key through", () => {
    const outputs = [
      humanizeActivity({ type: "LOGIN_FAILED", description: "Login attempt failed. AUTH_FAILED" }),
      humanizeActivity({ type: "X", description: "Action emergency_contact.created completed." }),
      humanizeActivity({ type: "X", description: "Failed: ACCESS_TOKEN_EXPIRED" }),
      humanizeActivity({ type: "X", description: "Action some_new_thing.archived completed." }),
    ];

    for (const text of outputs)
      expect(text).not.toMatch(/[A-Z]+_[A-Z]+|[a-z]+_[a-z]+|[a-z]\.[a-z]/);
  });
});
