/**
 * POST /api/run/claim   Body: { address?: string }
 *
 * Records ONE successful address run against the signed-in user and enforces
 * the billing model. Called by the client after a pipeline run succeeds (and,
 * for anonymous users, after they pass the gate). The meter counts runs here —
 * NOT PDF downloads.
 *
 * Precedence:
 *   1. Free run  — if the account still has its 1 free run, consume it.
 *   2. Subscription — if active/trialing: record the run; beyond included_runs
 *      it's overage (auto-charged via Stripe metered usage). Trial ends early
 *      once the 20-run cap is hit.
 *   3. Otherwise — 402: the client must send them to subscribe.
 */
import { NextRequest, NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { PLAN, STRIPE_PRICE_OVERAGE, subscriptionIsActive } from "@/lib/billing";

export const runtime = "nodejs";

// Bill one overage run: add a $1 invoice item to the customer, priced from the
// one-time overage price so the amount stays single-sourced in Stripe. Each
// overage run creates a fresh item; they all sweep onto the next invoice. Falls
// back to a raw $1 if the price isn't configured.
async function chargeOverage(customerId: string): Promise<boolean> {
  try {
    const stripe = getStripe();
    if (STRIPE_PRICE_OVERAGE) {
      await stripe.invoiceItems.create({
        customer: customerId,
        pricing: { price: STRIPE_PRICE_OVERAGE },
      });
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

export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const address = (await req.json().catch(() => ({})))?.address ?? null;
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
      return NextResponse.json({ ok: true, kind: "free" });
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

  if (!subscriptionIsActive(sub?.status)) {
    return NextResponse.json({ ok: false, reason: "subscribe" }, { status: 402 });
  }

  const periodStart: string | null = sub?.current_period_start ?? null;

  let countQ = db
    .from("report_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (periodStart) countQ = countQ.gte("billing_period_start", periodStart);
  const { count } = await countQ;
  const runsThisPeriod = count ?? 0;

  // Trial cap: end the trial early once they've used their 20 free trial runs.
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

  return NextResponse.json({
    ok: true,
    kind: isOverage ? "overage" : "included",
    runsThisPeriod: runsThisPeriod + 1,
    includedRuns,
  });
}
