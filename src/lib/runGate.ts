/**
 * Server-side run gating + metering — the single source of truth for
 *   (a) "may this user run a report right now?"  → checkEligibility (read-only)
 *   (b) "record one successful run + bill it"     → claimRun (mutating)
 *
 * /api/pipeline calls checkEligibility BEFORE proxying to the backend (so an
 * unauthenticated or out-of-quota caller never triggers the expensive pipeline
 * or receives the dataset) and claimRun AFTER the backend returns data (so a
 * failed run never burns the user's quota).
 *
 * Precedence mirrors the billing model (see billing.ts):
 *   1. Free run   — 1 per account, no card.
 *   2. Subscription — active/trialing; beyond included_runs it's overage
 *      (auto-charged). Trial ends early once the run cap is hit.
 *   3. Otherwise  — not allowed; client must send them to subscribe.
 */
import { supabase } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { PLAN, STRIPE_PRICE_OVERAGE, subscriptionIsActive } from "@/lib/billing";

export type Eligibility = { allowed: true } | { allowed: false; reason: "subscribe" };

// Read-only. Does NOT consume anything. Cheap enough to run before the pipeline.
export async function checkEligibility(userId: string): Promise<Eligibility> {
  const db = supabase();

  const { data: profile } = await db
    .from("profiles")
    .select("free_run_used")
    .eq("id", userId)
    .maybeSingle();

  // 1) Free run still available.
  if (!(profile?.free_run_used ?? false)) return { allowed: true };

  // 2) Active/trialing/past_due subscription (overage allowed, billed on claim).
  const { data: sub } = await db
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscriptionIsActive(sub?.status)) return { allowed: true };

  return { allowed: false, reason: "subscribe" };
}

// Bill one overage run: a $2 invoice item priced from the one-time overage
// price so the amount stays single-sourced in Stripe. Falls back to a raw
// amount if the price isn't configured.
async function chargeOverage(customerId: string): Promise<boolean> {
  try {
    const stripe = getStripe();
    if (STRIPE_PRICE_OVERAGE) {
      await stripe.invoiceItems.create({ customer: customerId, pricing: { price: STRIPE_PRICE_OVERAGE } });
    } else {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: PLAN.overagePerRunCents,
        currency: "usd",
        description: "DealBrief overage report run",
      });
    }
    return true;
  } catch (err) {
    console.error("overage invoice item failed:", err);
    return false;
  }
}

export type ClaimResult =
  | { ok: true; kind: "free" | "included" | "overage" }
  | { ok: false; reason: "subscribe" };

// Mutating. Records ONE successful run and enforces billing. Call ONLY after
// the backend returned data — never before — so failures don't consume quota.
export async function claimRun(userId: string, address: string | null): Promise<ClaimResult> {
  const db = supabase();

  const { data: profile } = await db
    .from("profiles")
    .select("free_run_used, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  // 1) Free run — atomic claim (update guarded on free_run_used=false).
  if (!(profile?.free_run_used ?? false)) {
    const { data: claimed } = await db
      .from("profiles")
      .update({ free_run_used: true })
      .eq("id", userId)
      .eq("free_run_used", false)
      .select("id");
    if (claimed && claimed.length > 0) {
      await db.from("report_runs").insert({ user_id: userId, address, is_free: true });
      return { ok: true, kind: "free" };
    }
    // lost the race — fall through to the subscription path
  }

  // 2) Subscription path.
  const { data: sub } = await db
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscriptionIsActive(sub?.status)) return { ok: false, reason: "subscribe" };

  const periodStart: string | null = sub?.current_period_start ?? null;

  let countQ = db.from("report_runs").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (periodStart) countQ = countQ.gte("billing_period_start", periodStart);
  const { count } = await countQ;
  const runsThisPeriod = count ?? 0;

  // Trial cap: end the trial early once they've used their trial runs.
  if (sub?.status === "trialing" && runsThisPeriod >= (sub.trial_run_cap ?? PLAN.trialRunCap)) {
    try {
      await getStripe().subscriptions.update(sub.stripe_subscription_id, { trial_end: "now" });
    } catch (err) {
      console.error("ending trial early failed:", err);
    }
  }

  const includedRuns = sub?.included_runs ?? PLAN.includedRuns;
  const isOverage = runsThisPeriod >= includedRuns;

  const { data: runRow } = await db
    .from("report_runs")
    .insert({ user_id: userId, address, billing_period_start: periodStart, is_overage: isOverage })
    .select("id")
    .maybeSingle();

  if (isOverage && profile?.stripe_customer_id) {
    const charged = await chargeOverage(profile.stripe_customer_id);
    if (charged && runRow?.id) {
      await db.from("report_runs").update({ stripe_usage_reported: true }).eq("id", runRow.id);
    }
  }

  return { ok: true, kind: isOverage ? "overage" : "included" };
}
