import { hasSupabaseServiceConfig } from "@/lib/supabase/config";
import { createSupabaseServiceClient, createSupabaseUserClient } from "@/lib/supabase/server";

/**
 * Ensures a freshly authenticated user has the baseline profile and
 * entitlement rows. Safe to call repeatedly thanks to upserts, so it works for
 * both first-time password registration and first-time OAuth sign-in.
 */
export async function provisionAuthedUser(input: {
  userId?: string | null;
  accessToken?: string | null;
  displayName?: string | null;
}) {
  if (!input.userId) {
    return;
  }

  const profile = {
    id: input.userId,
    display_name: input.displayName?.trim() || null,
    default_currency: "IDR",
    locale: "id-ID"
  };

  if (hasSupabaseServiceConfig()) {
    const service = createSupabaseServiceClient();
    await service.from("profiles").upsert(profile);
    await service.from("subscription_entitlements").upsert(
      {
        user_id: input.userId,
        plan: "free",
        status: "active"
      },
      { onConflict: "user_id" }
    );
    return;
  }

  if (input.accessToken) {
    const userClient = createSupabaseUserClient(input.accessToken);
    await userClient.from("profiles").upsert(profile);
  }
}
