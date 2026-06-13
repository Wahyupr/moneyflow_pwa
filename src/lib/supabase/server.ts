import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseElevatedKey,
  getSupabasePublishableKey,
  getSupabaseUrl,
  missingSupabaseAuthConfigMessage,
  missingSupabaseServiceConfigMessage
} from "@/lib/supabase/config";

export function createSupabaseAuthClient() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    throw new Error(missingSupabaseAuthConfigMessage);
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createSupabaseUserClient(accessToken: string) {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    throw new Error(missingSupabaseAuthConfigMessage);
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    }
  });
}

export function createSupabaseServiceClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseElevatedKey();

  if (!url || !key) {
    throw new Error(missingSupabaseServiceConfigMessage);
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
