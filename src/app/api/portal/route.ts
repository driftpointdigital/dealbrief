/**
 * POST /api/portal
 *
 * Returns a Stripe Customer Portal URL so the signed-in user can manage or
 * cancel their subscription and update payment methods. Requires an existing
 * Stripe customer (i.e. they've subscribed at least once).
 */
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { getStripe, baseUrl } from "@/lib/stripe";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const db = supabase();
  const { data: profile } = await db
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id as string | undefined;
  if (!customerId) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: baseUrl(),
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("portal error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
