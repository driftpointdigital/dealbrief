// Single source of truth for the DealBrief billing model. Keep in sync with
// supabase/migrations/0001_accounts_subscriptions_usage.sql and the Stripe
// Products/Prices you create (their IDs come in via env — see below).
//
// Model:
//   • 1 free address run per account (no card).
//   • $29/mo subscription, 20 runs included per period.
//   • $2/run overage beyond 20, auto-charged (Stripe invoice items).
//   • Trial: first 14 days OR first 10 runs, whichever comes first.
//   • The meter counts SUCCESSFUL ADDRESS RUNS, never PDF downloads.

export const PLAN = {
  priceMonthlyCents: 2900,   // $29.00 / month
  includedRuns: 20,          // runs included each billing period
  overagePerRunCents: 200,   // $2.00 per run beyond includedRuns
  trialDays: 14,             // trial length in days …
  trialRunCap: 10,           // … or this many runs, whichever comes first
  freeRunsPerAccount: 1,     // the no-card hook
} as const;

// Stripe Price IDs — created in the Stripe dashboard/API and supplied via env.
// STRIPE_PRICE_SUBSCRIPTION: recurring $49/mo Price (the base plan).
// STRIPE_PRICE_OVERAGE:      metered usage Price at $1/unit (the overage).
export const STRIPE_PRICE_SUBSCRIPTION = process.env.STRIPE_PRICE_SUBSCRIPTION || "";
export const STRIPE_PRICE_OVERAGE = process.env.STRIPE_PRICE_OVERAGE || "";

// A subscription status that grants access to run reports.
export function subscriptionIsActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due";
}
