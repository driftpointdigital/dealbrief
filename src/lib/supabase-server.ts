// Cookie-bound Supabase client for Route Handlers / Server Components. Reads the
// signed-in user's session from request cookies (anon key + RLS). For privileged
// writes that must bypass RLS, use the service-role client in ./supabase.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function supabaseServer(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component where cookies are read-only —
            // the middleware refreshes the session cookies instead.
          }
        },
      },
    },
  );
}

// Returns the authenticated user id, or null. Use to gate/attribute API routes.
export async function currentUserId(): Promise<string | null> {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}
