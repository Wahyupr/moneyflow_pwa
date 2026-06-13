import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { requireApiUser } from "../api/auth";
import { createSessionToken } from "../auth/session";


beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234567890";
});

describe("API auth guard", () => {

  it("rejects API requests without a token", async () => {
    const auth = await requireApiUser(new NextRequest("http://localhost/api/dashboard"));

    expect("response" in auth).toBe(true);
    expect("response" in auth ? auth.response?.status : 200).toBe(401);
  });

  it("rejects API requests with an invalid bearer token", async () => {
    const auth = await requireApiUser(
      new NextRequest("http://localhost/api/dashboard", {
        headers: {
          authorization: "Bearer invalid-token"
        }
      })
    );

    expect("response" in auth).toBe(true);
    expect("response" in auth ? auth.response?.status : 200).toBe(401);
  });

  it("rejects tampered session tokens before any domain API work runs", async () => {
    const { token } = createSessionToken({
      id: "00000000-0000-0000-0000-000000000001",
      email: "nara@example.com",
      role: "user",
      display_name: "Nara Putri"
    });
    const auth = await requireApiUser(
      new NextRequest("http://localhost/api/dashboard", {
        headers: {
          authorization: `Bearer ${token}x`
        }
      })
    );

    expect("response" in auth).toBe(true);
    expect("response" in auth ? auth.response?.status : 200).toBe(401);
  });

  it("accepts a valid session token", async () => {
    const { token } = createSessionToken({
      id: "00000000-0000-0000-0000-000000000001",
      email: "nara@example.com",
      role: "user",
      display_name: "Nara Putri"
    });
    const auth = await requireApiUser(
      new NextRequest("http://localhost/api/dashboard", {
        headers: {
          authorization: `Bearer ${token}`
        }
      })
    );

    if ("response" in auth) {
      throw new Error("Expected a valid session.");
    }

    expect(auth.user.email).toBe("nara@example.com");
  });

});

