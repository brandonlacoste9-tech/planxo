import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnvVar, validateDataLayerEnv } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function createClient() {
  validateDataLayerEnv();

  const cookieStore = await cookies();
  const supabaseUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL", "supabase-server");
  const supabaseAnonKey = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY", "supabase-server");

  return createServerClient<any>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

export async function createAdminClient() {
  validateDataLayerEnv();

  const supabaseUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL", "supabase-admin");
  const supabaseServiceRoleKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY", "supabase-admin");

  return createServerClient<any>(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}
