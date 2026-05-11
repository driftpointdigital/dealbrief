// Server-side Supabase client. Uses the service_role key, which bypasses
// Row Level Security — so this module must NEVER be imported by client
// components or any code that ships to the browser. API routes only.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env vars missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/**
 * Normalize an email for storage + lookup. Lowercase + trim, nothing fancy
 * — Gmail-alias collapsing intentionally skipped (see CLAUDE.md / chat
 * thread re: first-free-report design).
 */
export function normalizeEmail(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

/** Loose email shape check. Server-side last line of defense. */
export function isPlausibleEmail(email: string): boolean {
  const e = normalizeEmail(email);
  // Require an @, at least one char on each side, and a dot in the domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
