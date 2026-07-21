/**
 * POST /api/stripe/webhook
 *
 * Stripe -> Supabase sync. Stripe is the source of truth for subscription
 * state; this endpoint mirrors it into public.subscriptions. Signature-verified
 * with STRIPE_WEBHOOK_SECRET.
 *
 * Register the events: checkout.session.completed,
 * customer.subscription.created / updated / deleted.
 */
import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { PLAN, STRIPE_PRICE_SUBSCRIPTION } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toIso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null);

async function syncSubscription(sub: Stripe.Subscription) {
  const db = supabase();

  // Resolve the app user: prefer subscription metadata, else map via customer.
  let userId = (sub.metadata?.user_id as string) || "";
  if (!userId) {
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    if (customerId) {
      const { data } = await db
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      userId = (data?.id as string) ?? "";
    }
  }
  if (!userId) {
    console.error("stripe webhook: could not resolve user for subscription", sub.id);
    return;
  }

  // Period fields moved onto items in recent API versions — read either place.
  const item = sub.items?.data?.[0];
  const s = sub as unknown as Record<string, number | undefined>;
  const it = item as unknown as Record<string, number | undefined> | undefined;
  const periodStart = toIso(s.current_period_start ?? it?.current_period_start);
  const periodEnd = toIso(s.current_period_end ?? it?.current_period_end);

  const row = {
    user_id: userId,
    stripe_subscription_id: sub.id,
    stripe_price_id: STRIPE_PRICE_SUBSCRIPTION || item?.price?.id || null,
    status: sub.status,
    included_runs: PLAN.includedRuns,
    trial_run_cap: PLAN.trialRunCap,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    trial_end: toIso(sub.trial_end),
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from("subscriptions")
    .upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) console.error("stripe webhook: upsert failed", error);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("stripe webhook: signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await getStripe().subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("stripe webhook handler error:", err);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
