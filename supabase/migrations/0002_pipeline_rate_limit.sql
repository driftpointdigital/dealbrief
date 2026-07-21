-- Per-IP rate limiting for the open /api/pipeline endpoint. Each pipeline run
-- logs a row; the route counts recent rows per IP and 429s over the limit.
-- Service-role only (RLS on, no policies) — the browser never reads this.
create table if not exists public.pipeline_hits (
  id         uuid primary key default gen_random_uuid(),
  ip         text not null,
  created_at timestamptz not null default now()
);
create index if not exists pipeline_hits_ip_created_idx on public.pipeline_hits(ip, created_at);

alter table public.pipeline_hits enable row level security;
