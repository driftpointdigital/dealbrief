-- Wave 1 cleanup: remove the legacy per-PDF "reports" flow.
--
-- The routes that used this table (free-report, session-meta, generate-pdf,
-- checkout, eligibility) and the /report/[sessionId] page have been deleted.
-- The table stored free-user emails + full report metadata and had no committed
-- migration (created ad-hoc). It is superseded by the accounts / subscriptions /
-- report_runs model. Dropping it also removes two unauthenticated attack
-- surfaces (unlimited free branded PDFs, and the session-meta address leak).
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor).

drop table if exists public.reports;
