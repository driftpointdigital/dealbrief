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
    "units","zoning","assessedValue","landValue","improvements",
    "annualTaxes","askingPrice","brokerCapRate","buyerCapRate","occupancy","inPlaceRents",
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
  if (body.opexOverrides) metadata.opexOverrides = String(body.opexOverrides).slice(0, 100);

  // Pipeline — Assessor extras
  if (assessor.parcelId)    metadata.parcelId      = String(assessor.parcelId).slice(0, 100);
  if (assessor.source)      metadata.assessorSource = String(assessor.source).slice(0, 100);
  if (assessor.taxRate != null)
    metadata.taxRate = String(assessor.taxRate).slice(0, 20);
  // Sale history — packed as "price|year" (pipe separator avoids clash with dollar-formatted price)
  const saleP = assessor.salePrice ? String(assessor.salePrice) : "";
  const saleY = assessor.saleYear  ? String(assessor.saleYear)  : "";
  if (saleP || saleY) metadata.saleInfo = `${saleP}|${saleY}`.slice(0, 100);

  // Pipeline — FEMA
  if (fema.floodZone) metadata.femaZone = String(fema.floodZone).slice(0, 100);

  // Pipeline — Walk Score (packed as "walk|bike|transit|desc" to save 3 keys)
  if (ws.walk != null || ws.bike != null || ws.transit != null) {
    metadata.wsData = [
      ws.walk    != null ? String(ws.walk)    : "",
      ws.bike    != null ? String(ws.bike)    : "",
      ws.transit != null ? String(ws.transit) : "",
      ws.walkDescription ? String(ws.walkDescription).slice(0, 80) : "",
    ].join("|");
  }

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
  // Race + education — packed as "Black,Hispanic,White,BachPlus" to save 3 metadata keys
  if (census.pctBlack || census.pctHispanic || census.pctWhite || census.pctBachelorPlus)
    metadata.censusRace = [
      census.pctBlack        ? String(census.pctBlack)        : "",
      census.pctHispanic     ? String(census.pctHispanic)     : "",
      census.pctWhite        ? String(census.pctWhite)        : "",
      census.pctBachelorPlus ? String(census.pctBachelorPlus) : "",
    ].join(",");

  // Pipeline — Permits
  metadata.permitCount = String(permits.count ?? 0);
  if (permits.source) metadata.permitSource = String(permits.source).slice(0, 100);

  // Permit details — compact JSON for up to 5 permits
  const permitList = (permits.permits ?? []) as Array<Record<string, unknown>>;
  if (permitList.length > 0) {
    const compact = permitList.slice(0, 20).map(p => ({
      t: String(p.type || "").slice(0, 25),
      d: String(p.description || "").slice(0, 50),
      dt: String(p.fileDate || p.issueDate || "").slice(0, 10),
      v: p.jobValue ? Math.round(Number(p.jobValue)) : null,
    }));
    const fullJson = JSON.stringify(compact);
    // Stripe metadata: 500 char limit per key — split across up to 4 keys (covers ~20 permits)
    metadata.permitDetails  = fullJson.slice(0, 490);
    if (fullJson.length >  490) metadata.permitDetails2 = fullJson.slice( 490,  980);
    if (fullJson.length >  980) metadata.permitDetails3 = fullJson.slice( 980, 1470);
    if (fullJson.length > 1470) metadata.permitDetails4 = fullJson.slice(1470, 1960);
  }

  // Proximity to downtown (packed as "miles|minutes|city" to save 2 keys)
  if (proximityData.distanceMiles != null || proximityData.driveMinutes != null || proximityData.downtownCity) {
    metadata.proxData = [
      proximityData.distanceMiles != null ? String(proximityData.distanceMiles) : "",
      proximityData.driveMinutes  != null ? String(proximityData.driveMinutes)  : "",
      proximityData.downtownCity  ? String(proximityData.downtownCity).slice(0, 50) : "",
    ].join("|");
  }

  // MSA comparison (packed as compact JSON to save 4 keys)
  {
    const msaC: Record<string, unknown> = {};
    if (msaData.msaName)           msaC.n  = String(msaData.msaName).slice(0, 80);
    if (msaData.medianIncome)      msaC.i  = String(msaData.medianIncome).slice(0, 20);
    if (msaData.medianHomeValue)   msaC.h  = String(msaData.medianHomeValue).slice(0, 20);
    if (msaData.medianRent)        msaC.r  = String(msaData.medianRent).slice(0, 20);
    if (msaData.povertyRate)       msaC.p  = String(msaData.povertyRate).slice(0, 10);
    if (msaData.pctBachelorPlus != null) msaC.b = String(msaData.pctBachelorPlus).slice(0, 10);
    if (Object.keys(msaC).length > 0) metadata.msaJ = JSON.stringify(msaC).slice(0, 490);
  }

  // Census HH size (packed as "households|avgHH|avgRenter" to save 2 keys)
  if (census.totalHouseholds || census.avgHouseholdSize || census.avgRenterHouseholdSize) {
    metadata.censusHH = [
      census.totalHouseholds        ? String(census.totalHouseholds)        : "",
      census.avgHouseholdSize       ? String(census.avgHouseholdSize)       : "",
      census.avgRenterHouseholdSize ? String(census.avgRenterHouseholdSize) : "",
    ].join("|");
  }

  // HUD subsidized (packed as compact JSON to save 3 keys)
  if (hudData.nearbyAssistedProperties != null || hudData.nearbyAssistedUnits != null) {
    const hudC: Record<string, unknown> = {};
    if (hudData.nearbyAssistedProperties != null) hudC.p  = hudData.nearbyAssistedProperties;
    if (hudData.nearbyAssistedUnits != null)      hudC.u  = hudData.nearbyAssistedUnits;
    if (hudData.section8Properties != null)       hudC.s8 = hudData.section8Properties;
    if (Array.isArray(hudData.propertyNames) && hudData.propertyNames.length > 0)
      hudC.n = (hudData.propertyNames as string[]).slice(0, 3).join("; ").slice(0, 150);
    metadata.hudJ = JSON.stringify(hudC).slice(0, 490);
  }

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
