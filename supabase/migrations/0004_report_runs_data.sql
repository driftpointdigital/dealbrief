-- Report library: persist the pipeline payload for each metered run so
-- subscribers can revisit past reports (the #1 subscription churn hole was that
-- reports lived only in React state and vanished on tab close).
--
-- Stores the raw pipeline response (assessor/fema/crime/etc.) — enough to
-- re-render the Review & Adjust report from scratch. RLS already scopes
-- report_runs to self-read, so users can only see their own.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor).

alter table public.report_runs add column if not exists report_data jsonb;
