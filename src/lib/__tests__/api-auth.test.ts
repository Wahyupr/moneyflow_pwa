import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { requireApiUser } from "../api/auth";
import { createDemoSession } from "../demo-auth";

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

  it("rejects tampered demo tokens before any domain API work runs", async () => {
    const demo = await createDemoSession({
      email: "nara@example.com",
      displayName: "Nara Putri"
    });
    const auth = await requireApiUser(
      new NextRequest("http://localhost/api/dashboard", {
        headers: {
          authorization: `Bearer ${demo.session.access_token}x`
        }
      })
    );

    expect("response" in auth).toBe(true);
    expect("response" in auth ? auth.response?.status : 200).toBe(401);
  });
});
