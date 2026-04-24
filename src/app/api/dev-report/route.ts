import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { DealBriefPDF, ReportData } from "@/lib/pdf-template";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Key check — must match DEV_REPORT_SECRET env var
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const secret = process.env.DEV_REPORT_SECRET ?? "";
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const p = (body._pipeline ?? {}) as Record<string, unknown>;

  const fema        = (p.fema        ?? {}) as Record<string, unknown>;
  const ws          = (p.walkscore   ?? {}) as Record<string, unknown>;
  const crime       = (p.crime       ?? {}) as Record<string, unknown>;
  const census      = (p.census      ?? {}) as Record<string, unknown>;
  const permits     = (p.permits     ?? {}) as Record<string, unknown>;
  const assessor    = (p.assessor    ?? {}) as Record<string, unknown>;
  const schoolsRaw  = (p.schools     ?? {}) as Record<string, unknown>;
  const proximity   = (p.proximity   ?? {}) as Record<string, unknown>;
  const msa         = (p.msa         ?? {}) as Record<string, unknown>;
  const hud         = (p.hud         ?? {}) as Record<string, unknown>;
  const bls         = (p.bls         ?? {}) as Record<string, unknown>;

  const str  = (v: unknown, max = 500) => v != null ? String(v).slice(0, max) : "";
  const pick = (key: string, max = 500) => body[key] != null ? String(body[key]).slice(0, max) : "";

  // Permit details — compact JSON (same format as checkout route)
  const permitList = (permits.permits ?? []) as Array<Record<string, unknown>>;
  const permitDetails = permitList.length > 0
    ? JSON.stringify(permitList.slice(0, 20).map(p => ({
        t:  str(p.type        || "", 25),
        d:  str(p.description || "", 50),
        dt: str(p.fileDate || p.issueDate || "", 10),
        v:  p.jobValue ? Math.round(Number(p.jobValue)) : null,
      })))
    : "";

  // Schools — compact JSON
  const schoolList = (schoolsRaw.schools ?? []) as Array<Record<string, unknown>>;
  const schoolsData = schoolList.length > 0
    ? JSON.stringify(schoolList.map(s => ({
        n: str(s.name  || "", 40),
        l: str(s.level || "", 12),
        r: str(s.ratingBand || "", 15),
        d: s.distanceMiles != null ? Number(s.distanceMiles).toFixed(1) : null,
      })))
    : "";

  // BLS — compact JSON
  let blsData = "";
  if (bls.ok) {
    const c: Record<string, unknown> = {};
    if (bls.unemploymentRate        != null) c.ur  = bls.unemploymentRate;
    if (bls.nationalUnemploymentRate != null) c.nat = bls.nationalUnemploymentRate;
    if (bls.employment              != null) c.emp = bls.employment;
    if (bls.laborForce              != null) c.lf  = bls.laborForce;
    if (bls.periodLabel)                      c.per = str(bls.periodLabel, 20);
    if (bls.countyName)                       c.co  = str(bls.countyName,  30);
    blsData = JSON.stringify(c);
  }

  // Census race + education — packed as "Black,Hispanic,White,BachPlus"
  const censusRaceParts = [
    census.pctBlack        ? str(census.pctBlack)        : "",
    census.pctHispanic     ? str(census.pctHispanic)     : "",
    census.pctWhite        ? str(census.pctWhite)        : "",
    census.pctBachelorPlus ? str(census.pctBachelorPlus) : "",
  ];

  // Revenue assumptions
  const vac = body.vacancyPct     ? str(body.vacancyPct)     : "5.0";
  const bd  = body.badDebtPct     ? str(body.badDebtPct)     : "1.0";
  const oth = body.otherIncomePct ? str(body.otherIncomePct) : "50";

  // Rates / LTVs — accept array or JSON string
  const parseArr = (v: unknown, fallback: string[]) => {
    if (Array.isArray(v)) return v as string[];
    try { return v ? JSON.parse(String(v)) : fallback; } catch { return fallback; }
  };

  const data: ReportData = {
    // Property
    address:        pick("address"),
    propertyType:   pick("propertyType"),
    yearBuilt:      pick("yearBuilt"),
    buildingArea:   pick("buildingArea"),
    lotSize:        pick("lotSize"),
    units:          pick("units"),
    zoning:         pick("zoning"),
    // Assessor
    assessedValue:  pick("assessedValue"),
    landValue:      pick("landValue"),
    improvements:   pick("improvements"),
    lpv:            pick("lpv"),
    adjustedLpv:    pick("adjustedLpv"),
    assessmentRatio: pick("assessmentRatio"),
    reappraisalYear: assessor.reappraisalYear ? String(assessor.reappraisalYear).slice(0, 10) : pick("reappraisalYear"),
    taxRate:        assessor.taxRate != null
                      ? String(assessor.taxRate).slice(0, 20)
                      : pick("taxRate"),
    annualTaxes:    pick("annualTaxes"),
    parcelId:       str(assessor.parcelId,    100),
    assessorSource: str(assessor.source,      100),
    // Sale history
    salePrice:      assessor.salePrice ? str(assessor.salePrice) : "",
    saleYear:       assessor.saleYear  ? str(assessor.saleYear)  : "",
    // Deal inputs
    askingPrice:    pick("askingPrice"),
    brokerCapRate:  pick("brokerCapRate"),
    buyerCapRate:   pick("buyerCapRate"),
    occupancy:      pick("occupancy"),
    inPlaceRents:   pick("inPlaceRents"),
    brokerClaims:   pick("brokerClaims"),
    // Assumptions
    rates:      parseArr(body.rates, ["8.5","7.5","6.5","5.0"]),
    ltvs:       parseArr(body.ltvs,  ["75","50"]),
    amortYears: pick("amortYears") || "30",
    ioPeriod:   pick("ioPeriod")   || "0",
    // Revenue assumptions
    vacancyPct:     vac,
    badDebtPct:     bd,
    otherIncomePct: oth,
    // FEMA
    femaZone:    str(fema.floodZone, 100),
    // Walk Score
    walkScore:   ws.walk    != null ? str(ws.walk)    : "",
    bikeScore:   ws.bike    != null ? str(ws.bike)    : "",
    transitScore:ws.transit != null ? str(ws.transit) : "",
    walkDesc:    str(ws.walkDescription, 100),
    // Crime
    crimeData:        str(crime.crimeDataJson, 490),
    crimeOverall:     "",
    crimeViolent:     "",
    crimeProp:        "",
    crimeRate:        "",
    crimeViolentRate: "",
    crimePct:         "",
    // Census
    censusIncome:    census.medianIncome    ? str(census.medianIncome)    : "",
    censusPop:       census.population      ? str(census.population)      : "",
    censusAge:       census.medianAge       ? str(census.medianAge)       : "",
    censusRent:      census.medianRent      ? str(census.medianRent)      : "",
    censusHomeVal:   census.medianHomeValue ? str(census.medianHomeValue) : "",
    censusPoverty:   census.povertyRate     ? str(census.povertyRate)     : "",
    censusRenterPct: census.renterPct       ? str(census.renterPct)       : "",
    censusPctBlack:    censusRaceParts[0],
    censusPctHispanic: censusRaceParts[1],
    censusPctWhite:    censusRaceParts[2],
    censusBachPlus:    censusRaceParts[3] ?? "",
    censusHouseholds:    census.totalHouseholds        ? str(census.totalHouseholds)        : "",
    censusAvgHHSize:     census.avgHouseholdSize       ? str(census.avgHouseholdSize)       : "",
    censusAvgRenterSize: census.avgRenterHouseholdSize ? str(census.avgRenterHouseholdSize) : "",
    // Permits
    permitCount:   str(permits.count ?? 0),
    permitSource:  str(permits.source, 100),
    permitDetails,
    // Schools
    schoolsData,
    // Proximity
    proximityMiles:   proximity.distanceMiles != null ? str(proximity.distanceMiles) : "",
    proximityMinutes: proximity.driveMinutes  != null ? str(proximity.driveMinutes)  : "",
    proximityCity:    str(proximity.downtownCity, 50),
    // MSA
    msaName:     str(msa.msaName,        80),
    msaIncome:   msa.medianIncome    ? str(msa.medianIncome)    : "",
    msaHomeVal:  msa.medianHomeValue ? str(msa.medianHomeValue) : "",
    msaRent:     msa.medianRent      ? str(msa.medianRent)      : "",
    msaPoverty:  msa.povertyRate     ? str(msa.povertyRate)     : "",
    msaBachPlus: msa.pctBachelorPlus != null ? str(msa.pctBachelorPlus) : "",
    // HUD
    hudNearbyProps:   hud.nearbyAssistedProperties != null ? str(hud.nearbyAssistedProperties) : "",
    hudNearbyUnits:   hud.nearbyAssistedUnits      != null ? str(hud.nearbyAssistedUnits)      : "",
    hudSection8Count: hud.section8Properties       != null ? str(hud.section8Properties)       : "",
    hudPropNames:     Array.isArray(hud.propertyNames)
                        ? (hud.propertyNames as string[]).slice(0, 3).join("; ").slice(0, 200)
                        : "",
    // BLS
    blsData,
    // Opex overrides
    opexOverrides: pick("opexOverrides"),
  };

  let pdfBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(React.createElement(DealBriefPDF, { data }) as any);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Dev PDF render error:", msg);
    return NextResponse.json({ error: "PDF generation failed", detail: msg }, { status: 500 });
  }

  const streetAddress = (data.address || "").split(",")[0].trim() || "DealBrief";
  const safeStreet = streetAddress.replace(/[<>:"/\\|?*]/g, "").trim();
  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="DealBrief - ${safeStreet}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
