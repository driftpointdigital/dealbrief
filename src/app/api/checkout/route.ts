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
  const assessor    = (p.assessor   ?? {}) as Record<string, unknown>;
  const geo         = (p.geo        ?? {}) as Record<string, unknown>;
  const schoolsData = (p.schools    ?? {}) as Record<string, unknown>;
  const proximityData = (p.proximity ?? {}) as Record<string, unknown>;
  const msaData     = (p.msa        ?? {}) as Record<string, unknown>;
  const hudData     = (p.hud        ?? {}) as Record<string, unknown>;

  const metadata: Record<string, string> = {};

  // Form fields
  for (const f of [
    "address","propertyType","yearBuilt","buildingArea","lotSize",
    "units","unitMix","zoning","assessedValue","landValue","improvements",
    "taxRate","askingPrice","brokerCapRate","occupancy","inPlaceRents",
    "brokerClaims","amortYears","ioPeriod",
  ]) {
    if (body[f]) metadata[f] = String(body[f]).slice(0, 500);
  }
  if (body.rates) metadata.rates = JSON.stringify(body.rates).slice(0, 500);
  if (body.ltvs)  metadata.ltvs  = JSON.stringify(body.ltvs).slice(0, 500);

  // Pipeline — Assessor extras
  if (assessor.annualTaxes) metadata.annualTaxes   = String(assessor.annualTaxes).slice(0, 50);
  if (assessor.parcelId)    metadata.parcelId      = String(assessor.parcelId).slice(0, 100);
  if (assessor.source)      metadata.assessorSource = String(assessor.source).slice(0, 100);

  // Pipeline — FEMA
  if (fema.floodZone) metadata.femaZone = String(fema.floodZone).slice(0, 100);

  // Pipeline — Walk Score
  if (ws.walk != null)       metadata.walkScore    = String(ws.walk);
  if (ws.bike != null)       metadata.bikeScore    = String(ws.bike);
  if (ws.transit != null)    metadata.transitScore = String(ws.transit);
  if (ws.walkDescription)    metadata.walkDesc     = String(ws.walkDescription).slice(0, 100);

  // Pipeline — Crime
  if (crime.overallGrade)           metadata.crimeOverall     = String(crime.overallGrade);
  if (crime.violentGrade)           metadata.crimeViolent     = String(crime.violentGrade);
  if (crime.propertyGrade)          metadata.crimeProp        = String(crime.propertyGrade);
  if (crime.ratePerThousand)        metadata.crimeRate        = String(crime.ratePerThousand);
  if (crime.violentRatePerThousand) metadata.crimeViolentRate = String(crime.violentRatePerThousand);
  if (crime.safetyPercentile)       metadata.crimePct         = String(crime.safetyPercentile);

  // Pipeline — Census
  if (census.medianIncome)    metadata.censusIncome    = pick(census, "medianIncome");
  if (census.population)      metadata.censusPop       = String(census.population);
  if (census.medianAge)       metadata.censusAge       = String(census.medianAge);
  if (census.medianRent)      metadata.censusRent      = pick(census, "medianRent");
  if (census.medianHomeValue) metadata.censusHomeVal   = pick(census, "medianHomeValue");
  if (census.povertyRate)     metadata.censusPoverty   = pick(census, "povertyRate");
  if (census.renterPct)       metadata.censusRenterPct = pick(census, "renterPct");
  if (census.pctBlack)        metadata.censusPctBlack    = String(census.pctBlack);
  if (census.pctHispanic)     metadata.censusPctHispanic = String(census.pctHispanic);
  if (census.pctWhite)        metadata.censusPctWhite    = String(census.pctWhite);

  // Pipeline — Permits
  metadata.permitCount = String(permits.count ?? 0);
  if (permits.source) metadata.permitSource = String(permits.source).slice(0, 100);

  // Permit details — compact JSON for up to 5 permits
  const permitList = (permits.permits ?? []) as Array<Record<string, unknown>>;
  if (permitList.length > 0) {
    const compact = permitList.slice(0, 5).map(p => ({
      t: String(p.type || "").slice(0, 25),
      d: String(p.description || "").slice(0, 45),
      dt: String(p.fileDate || p.issueDate || "").slice(0, 10),
      v: p.jobValue ? Math.round(Number(p.jobValue)) : null,
    }));
    metadata.permitDetails = JSON.stringify(compact).slice(0, 490);
  }

  // Geo extras
  if (geo.city)  metadata.geoCity  = String(geo.city).slice(0, 50);
  if (geo.state) metadata.geoState = String(geo.state).slice(0, 10);

  // Proximity to downtown
  if (proximityData.distanceMiles != null) metadata.proximityMiles   = String(proximityData.distanceMiles);
  if (proximityData.driveMinutes  != null) metadata.proximityMinutes = String(proximityData.driveMinutes);
  if (proximityData.downtownCity)          metadata.proximityCity    = String(proximityData.downtownCity).slice(0, 50);

  // MSA comparison
  if (msaData.msaName)       metadata.msaName      = String(msaData.msaName).slice(0, 80);
  if (msaData.medianIncome)  metadata.msaIncome    = String(msaData.medianIncome).slice(0, 20);
  if (msaData.medianHomeValue) metadata.msaHomeVal = String(msaData.medianHomeValue).slice(0, 20);
  if (msaData.medianRent)    metadata.msaRent      = String(msaData.medianRent).slice(0, 20);
  if (msaData.povertyRate)   metadata.msaPoverty   = String(msaData.povertyRate).slice(0, 10);

  // Census HH size
  if (census.totalHouseholds)        metadata.censusHouseholds    = String(census.totalHouseholds);
  if (census.avgHouseholdSize)       metadata.censusAvgHHSize     = String(census.avgHouseholdSize);
  if (census.avgRenterHouseholdSize) metadata.censusAvgRenterSize = String(census.avgRenterHouseholdSize);

  // HUD subsidized
  if (hudData.nearbyAssistedProperties != null)
    metadata.hudNearbyProps = String(hudData.nearbyAssistedProperties);
  if (hudData.nearbyAssistedUnits != null)
    metadata.hudNearbyUnits = String(hudData.nearbyAssistedUnits);
  if (hudData.section8Properties != null)
    metadata.hudSection8Count = String(hudData.section8Properties);
  if (Array.isArray(hudData.propertyNames) && hudData.propertyNames.length > 0)
    metadata.hudPropNames = (hudData.propertyNames as string[]).slice(0, 3).join("; ").slice(0, 200);

  // Schools — compact JSON for up to 3 schools
  const schoolList = (schoolsData.schools ?? []) as Array<Record<string, unknown>>;
  if (schoolList.length > 0) {
    const compact = schoolList.map(s => ({
      n: String(s.name || "").slice(0, 40),
      l: String(s.level || "").slice(0, 12),
      r: String(s.ratingBand || "").slice(0, 15),
      d: s.distanceMiles != null ? Number(s.distanceMiles).toFixed(1) : null,
    }));
    metadata.schoolsData = JSON.stringify(compact).slice(0, 490);
  }

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
