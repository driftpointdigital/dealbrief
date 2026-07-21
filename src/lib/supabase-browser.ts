"use client";
// Browser-side Supabase client (anon key) for auth. Safe to ship to the client:
// the anon key is RLS-gated. Singleton so we don't spin up a client per render.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

// Returns null when the public env vars are absent (e.g. during a build with
// missing config) so prerendering never crashes — callers must handle null.
export function supabaseBrowser(): SupabaseClient | null {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _client = createBrowserClient(url, key);
  return _client;
}
