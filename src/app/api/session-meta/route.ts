import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/supabase";

const FREE_PREFIX = "free-";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) return NextResponse.json({});

  // Free path: pull address from the Supabase row's metadata.
  if (sessionId.startsWith(FREE_PREFIX)) {
    const uuid = sessionId.slice(FREE_PREFIX.length);
    try {
      const { data, error } = await supabase()
        .from("reports")
        .select("metadata")
        .eq("id", uuid)
        .eq("source", "free")
        .single();
      if (error || !data) return NextResponse.json({});
      const meta = (data.metadata ?? {}) as Record<string, string>;
      return NextResponse.json({ address: meta.address ?? "" });
    } catch {
      return NextResponse.json({});
    }
  }

  // Paid path: Stripe session.
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({ address: session.metadata?.address ?? "" });
  } catch {
    return NextResponse.json({});
  }
}
