-- Persistent ZIP-level crime cache, written/read by the pipeline (Railway) via
-- the service-role key. CrimeGrade is scraped through ScraperAPI, which is flaky
-- (~40%/attempt) and slow (~30s) because the site is Cloudflare-protected, but
-- crime grades are ZIP-level and stable for months — so caching a successful
-- pull makes every future report in that ZIP instant and reliable.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor).

create table if not exists public.crime_cache (
  zip        text primary key,
  data       jsonb not null,
  fetched_at timestamptz not null default now()
);

-- The pipeline uses the service_role key (bypasses RLS). Enable RLS with NO anon
-- policy so the anon key can't read the table (it holds no PII, but keep it
-- internal-only, consistent with the other tables).
alter table public.crime_cache enable row level security;
