import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!);

function baseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function pick(obj: Record<string, unknown>, key: string): string {
  const v = obj?.[key];
  return v != null ? String(v).slice(0, 500) : "";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const p = (body._pipeline ?? {}) as Record<string, unknown>;
  const fema    = (p.fema    ?? {}) as Record<string, unknown>;
  const ws      = (p.walkscore ?? {}) as Record<string, unknown>;
  const crime   = (p.crime   ?? {}) as Record<string, unknown>;
  const census  = (p.census  ?? {}) as Record<string, unknown>;
  const permits = (p.permits ?? {}) as Record<string, unknown>;

  const metadata: Record<string, string> = {};

  // Form fields
  for (const f of [
    "address","propertyType","yearBuilt","buildingArea","lotSize",
    "units","unitMix","assessedValue","landValue","improvements",
    "taxRate","askingPrice","brokerCapRate","occupancy","inPlaceRents",
    "brokerClaims","amortYears","ioPeriod",
  ]) {
    if (body[f]) metadata[f] = String(body[f]).slice(0, 500);
  }
  if (body.rates) metadata.rates = JSON.stringify(body.rates).slice(0, 500);
  if (body.ltvs)  metadata.ltvs  = JSON.stringify(body.ltvs).slice(0, 500);

  // Pipeline — FEMA
  if (fema.floodZone) metadata.femaZone = String(fema.floodZone).slice(0, 100);

  // Pipeline — Walk Score
  if (ws.walk != null) metadata.walkScore    = String(ws.walk);
  if (ws.bike != null) metadata.bikeScore    = String(ws.bike);
  if (ws.transit != null) metadata.transitScore = String(ws.transit);
  if (ws.walkDescription) metadata.walkDesc  = String(ws.walkDescription).slice(0, 100);

  // Pipeline — Crime
  if (crime.overallGrade)         metadata.crimeOverall  = String(crime.overallGrade);
  if (crime.violentGrade)         metadata.crimeViolent  = String(crime.violentGrade);
  if (crime.propertyGrade)        metadata.crimeProp     = String(crime.propertyGrade);
  if (crime.ratePerThousand)      metadata.crimeRate     = String(crime.ratePerThousand);
  if (crime.violentRatePerThousand) metadata.crimeViolentRate = String(crime.violentRatePerThousand);
  if (crime.safetyPercentile)     metadata.crimePct      = String(crime.safetyPercentile);

  // Pipeline — Census
  if (census.medianIncome)    metadata.censusIncome   = pick(census, "medianIncome");
  if (census.population)      metadata.censusPop      = String(census.population);
  if (census.medianAge)       metadata.censusAge      = String(census.medianAge);
  if (census.medianRent)      metadata.censusRent     = pick(census, "medianRent");
  if (census.medianHomeValue) metadata.censusHomeVal  = pick(census, "medianHomeValue");
  if (census.povertyRate)     metadata.censusPoverty  = pick(census, "povertyRate");
  if (census.renterPct)       metadata.censusRenterPct = pick(census, "renterPct");
  if (census.pctBlack)        metadata.censusPctBlack  = String(census.pctBlack);
  if (census.pctHispanic)     metadata.censusPctHispanic = String(census.pctHispanic);
  if (census.pctWhite)        metadata.censusPctWhite  = String(census.pctWhite);

  // Pipeline — Permits
  metadata.permitCount  = String(permits.count ?? 0);
  if (permits.source)   metadata.permitSource = String(permits.source).slice(0, 100);

  const base = baseUrl();

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set in environment" }, { status: 500 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: "DealBrief Report",
            description: body.address || "Pre-offer property research report",
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
