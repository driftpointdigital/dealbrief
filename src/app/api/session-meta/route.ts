import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) return NextResponse.json({});

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({ address: session.metadata?.address ?? "" });
  } catch {
    return NextResponse.json({});
  }
}
