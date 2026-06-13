import { describe, expect, it } from "vitest";
import { validateLoginInput, validateRegisterInput } from "../auth-validation";

describe("auth form validation", () => {
  it("accepts a valid login payload", () => {
    expect(validateLoginInput({ email: "nara@example.com", password: "secret123" })).toEqual({
      ok: true,
      data: { email: "nara@example.com", password: "secret123" }
    });
  });

  it("rejects invalid login email and short password", () => {
    expect(validateLoginInput({ email: "nara", password: "123" })).toEqual({
      ok: false,
      errors: {
        email: "Enter a valid email address.",
        password: "Password must be at least 8 characters."
      }
    });
  });

  it("requires name, valid email, strong enough password, and terms for registration", () => {
    expect(
      validateRegisterInput({
        fullName: " ",
        email: "bad-email",
        password: "short",
        acceptedTerms: false
      })
    ).toEqual({
      ok: false,
      errors: {
        fullName: "Full name is required.",
        email: "Enter a valid email address.",
        password: "Password must be at least 8 characters.",
        acceptedTerms: "Accept the terms to create an account."
      }
    });
  });
});
