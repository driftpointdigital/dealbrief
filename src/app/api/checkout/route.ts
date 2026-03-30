import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const getStripe = () => new Stripe(process.env.STRIPE_SECRET_KEY!);

function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
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
  const blsData     = (p.bls        ?? {}) as Record<string, unknown>;

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
  // Revenue assumptions — packed as "vacancy,badDebt,otherIncomePct" to save keys
  const vac = body.vacancyPct     ? String(body.vacancyPct)     : "5.0";
  const bd  = body.badDebtPct     ? String(body.badDebtPct)     : "1.0";
  const oth = body.otherIncomePct ? String(body.otherIncomePct) : "50";
  metadata.revAssumptions = `${vac},${bd},${oth}`.slice(0, 50);

  // Pipeline — Assessor extras
  if (assessor.annualTaxes) metadata.annualTaxes   = String(assessor.annualTaxes).slice(0, 50);
  if (assessor.parcelId)    metadata.parcelId      = String(assessor.parcelId).slice(0, 100);
  if (assessor.source)      metadata.assessorSource = String(assessor.source).slice(0, 100);
  // Sale history — packed as "price|year" (pipe separator avoids clash with dollar-formatted price)
  const saleP = assessor.salePrice ? String(assessor.salePrice) : "";
  const saleY = assessor.saleYear  ? String(assessor.saleYear)  : "";
  if (saleP || saleY) metadata.saleInfo = `${saleP}|${saleY}`.slice(0, 100);

  // Pipeline — FEMA
  if (fema.floodZone) metadata.femaZone = String(fema.floodZone).slice(0, 100);

  // Pipeline — Walk Score
  if (ws.walk != null)       metadata.walkScore    = String(ws.walk);
  if (ws.bike != null)       metadata.bikeScore    = String(ws.bike);
  if (ws.transit != null)    metadata.transitScore = String(ws.transit);
  if (ws.walkDescription)    metadata.walkDesc     = String(ws.walkDescription).slice(0, 100);

  // Pipeline — Crime (compact JSON covers both CrimeGrade and Dallas Open Data)
  if (crime.crimeDataJson) metadata.crimeData = String(crime.crimeDataJson).slice(0, 490);

  // Pipeline — Census
  if (census.medianIncome)    metadata.censusIncome    = pick(census, "medianIncome");
  if (census.population)      metadata.censusPop       = String(census.population);
  if (census.medianAge)       metadata.censusAge       = String(census.medianAge);
  if (census.medianRent)      metadata.censusRent      = pick(census, "medianRent");
  if (census.medianHomeValue) metadata.censusHomeVal   = pick(census, "medianHomeValue");
  if (census.povertyRate)     metadata.censusPoverty   = pick(census, "povertyRate");
  if (census.renterPct)       metadata.censusRenterPct = pick(census, "renterPct");
  // Race — packed as "Black,Hispanic,White" to save 2 metadata keys
  if (census.pctBlack || census.pctHispanic || census.pctWhite)
    metadata.censusRace = [
      census.pctBlack    ? String(census.pctBlack)    : "",
      census.pctHispanic ? String(census.pctHispanic) : "",
      census.pctWhite    ? String(census.pctWhite)    : "",
    ].join(",");

  // Pipeline — Permits
  metadata.permitCount = String(permits.count ?? 0);
  if (permits.source) metadata.permitSource = String(permits.source).slice(0, 100);

  // Permit details — compact JSON for up to 5 permits
  const permitList = (permits.permits ?? []) as Array<Record<string, unknown>>;
  if (permitList.length > 0) {
    const compact = permitList.slice(0, 15).map(p => ({
      t: String(p.type || "").slice(0, 25),
      d: String(p.description || "").slice(0, 50),
      dt: String(p.fileDate || p.issueDate || "").slice(0, 10),
      v: p.jobValue ? Math.round(Number(p.jobValue)) : null,
    }));
    const fullJson = JSON.stringify(compact);
    // Stripe metadata: 500 char limit per key — split across two keys if needed
    metadata.permitDetails  = fullJson.slice(0, 490);
    if (fullJson.length > 490) metadata.permitDetails2 = fullJson.slice(490, 980);
  }

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

  // BLS employment — compact JSON
  if (blsData.ok) {
    const blsCompact: Record<string, unknown> = {};
    if (blsData.unemploymentRate != null)        blsCompact.ur  = blsData.unemploymentRate;
    if (blsData.nationalUnemploymentRate != null) blsCompact.nat = blsData.nationalUnemploymentRate;
    if (blsData.employment != null)              blsCompact.emp = blsData.employment;
    if (blsData.laborForce != null)              blsCompact.lf  = blsData.laborForce;
    if (blsData.periodLabel)                     blsCompact.per = String(blsData.periodLabel).slice(0, 20);
    if (blsData.countyName)                      blsCompact.co  = String(blsData.countyName).slice(0, 30);
    metadata.blsData = JSON.stringify(blsCompact).slice(0, 490);
  }

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
