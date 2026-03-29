import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!);

function baseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Pack all report data into Stripe session metadata.
  // Each value is capped at 500 chars (Stripe limit).
  const metadata: Record<string, string> = {};
  const fields = [
    "address", "propertyType", "yearBuilt", "buildingArea", "lotSize",
    "units", "unitMix", "assessedValue", "landValue", "improvements",
    "taxRate", "askingPrice", "brokerCapRate", "occupancy", "inPlaceRents",
    "amortYears", "ioPeriod",
  ];
  for (const f of fields) {
    if (body[f]) metadata[f] = String(body[f]).slice(0, 500);
  }
  if (body.brokerClaims) metadata.brokerClaims = String(body.brokerClaims).slice(0, 500);
  if (body.rates) metadata.rates = JSON.stringify(body.rates).slice(0, 500);
  if (body.ltvs) metadata.ltvs = JSON.stringify(body.ltvs).slice(0, 500);

  const base = baseUrl();

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "DealBrief Report",
              description: body.address || "Pre-offer property research report",
            },
            unit_amount: 2900, // $29.00
          },
          quantity: 1,
        },
      ],
      metadata,
      success_url: `${base}/report/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Checkout error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
