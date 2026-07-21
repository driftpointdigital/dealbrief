/**
 * GET /api/account
 *
 * Returns the signed-in user's account summary: free-run availability,
 * subscription status, and runs used in the current billing period. Drives the
 * R&A gate. Reads via the service-role client (RLS bypass) after authenticating
 * the caller through their cookie session.
 */
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { subscriptionIsActive } from "@/lib/billing";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = supabase();

  const { data: profile } = await db
    .from("profiles")
    .select("email, free_run_used")
    .eq("id", userId)
    .maybeSingle();

  const { data: sub } = await db
    .from("subscriptions")
    .select("status, included_runs, current_period_start")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const active = subscriptionIsActive(sub?.status);

  // Runs used in the current period (subscription period, else lifetime).
  let runsThisPeriod = 0;
  {
    let q = db.from("report_runs").select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (sub?.current_period_start) q = q.gte("billing_period_start", sub.current_period_start);
    const { count } = await q;
    runsThisPeriod = count ?? 0;
  }

  const freeRunAvailable = !(profile?.free_run_used ?? false);
  // Can run if a free run is available, or the subscription is active (overage
  // keeps active subscribers runnable past their included_runs).
  const canRun = freeRunAvailable || active;

  return NextResponse.json({
    email: profile?.email ?? null,
    freeRunAvailable,
    subscription: sub
      ? {
          status: sub.status,
          includedRuns: sub.included_runs,
          periodStart: sub.current_period_start,
        }
      : null,
    runsThisPeriod,
    canRun,
  });
}
