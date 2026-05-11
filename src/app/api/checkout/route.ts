import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { buildReportMetadata } from "@/lib/buildReportMetadata";
import { isPlausibleEmail, normalizeEmail } from "@/lib/supabase";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!);

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const metadata = buildReportMetadata(body);

  const base = baseUrl();

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set in environment" }, { status: 500 });
  }

  // Prefill the customer's email in Stripe Checkout if we collected it
  // upstream on the R&A form. Stripe still lets them edit it on the
  // hosted checkout page.
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const customerEmail =
    rawEmail && isPlausibleEmail(rawEmail) ? normalizeEmail(rawEmail) : undefined;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      ...(customerEmail ? { customer_email: customerEmail } : {}),
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "DealBrief Report",
            description: typeof body.address === "string" ? body.address : "Pre-offer property research report",
          },
          unit_amount: 2900,
        },
        quantity: 1,
      }],
      metadata,
      success_url: `${base}/report/{CHECKOUT_SESSION_ID}`,
      cancel_url:  `${base}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Checkout error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
