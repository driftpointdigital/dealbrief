/**
 * POST /api/subscribe
 *
 * Starts a Stripe subscription checkout for the signed-in user:
 *   • base plan ($49/mo, STRIPE_PRICE_SUBSCRIPTION)
 *   • metered overage ($1/run, STRIPE_PRICE_OVERAGE) — no quantity; usage is
 *     reported from the meter (see Phase 4).
 *   • 30-day trial (the 20-run trial cap is enforced in-app).
 *
 * Requires auth. Creates/links a Stripe customer to the user's profile, then
 * returns the hosted-checkout URL.
 */
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { getStripe, baseUrl } from "@/lib/stripe";
import { STRIPE_PRICE_SUBSCRIPTION, PLAN } from "@/lib/billing";
import type Stripe from "stripe";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!STRIPE_PRICE_SUBSCRIPTION) {
    return NextResponse.json({ error: "STRIPE_PRICE_SUBSCRIPTION not configured" }, { status: 500 });
  }

  const db = supabase();
  const { data: profile } = await db
    .from("profiles")
    .select("email, stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const stripe = getStripe();

  // Reuse or create the Stripe customer, then persist it on the profile.
  let customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? undefined,
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    await db.from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  }

  // Subscription line items = the base plan only. Overage is billed separately
  // as per-run invoice items (see /api/run/claim), so it is NOT a subscription
  // line item (the overage price is a one-time $1 price, not a metered one).
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: STRIPE_PRICE_SUBSCRIPTION, quantity: 1 },
  ];

  const base = baseUrl();
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: PLAN.trialDays,
        metadata: { user_id: userId },
      },
      client_reference_id: userId,
      success_url: `${base}/?subscribed=1`,
      cancel_url: `${base}/?subscribe_canceled=1`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("subscribe error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
