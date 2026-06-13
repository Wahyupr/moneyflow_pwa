import { createSignedDemoToken } from "@/lib/auth/session-token";

export { getAuthApiEndpoint, getPostAuthRedirect } from "@/lib/auth/client";

export type DemoSessionPayload = {
  provider: "demo";
  user: {
    id: string;
    email: string;
    user_metadata: {
      display_name: string | null;
    };
  };
  session: {
    access_token: string;
    token_type: "bearer";
    expires_in: number;
  };
};

export async function createDemoSession(input: { email: string; displayName?: string | null }): Promise<DemoSessionPayload> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || null;
  const token = await createSignedDemoToken({ email, displayName });

  return {
    provider: "demo",
    user: {
      id: `demo:${email}`,
      email,
      user_metadata: {
        display_name: displayName
      }
    },
    session: {
      access_token: token.token,
      token_type: "bearer",
      expires_in: token.expiresIn
    }
  };
}

export function isMissingSupabaseConfigError(error: unknown) {
  return error instanceof Error && /Supabase (?:auth|service) environment variables are not configured/i.test(error.message);
}
