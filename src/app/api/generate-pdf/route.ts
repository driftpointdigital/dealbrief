import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { DealBriefPDF, ReportData } from "@/lib/pdf-template";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
  }

  const m = session.metadata ?? {};

  const data: ReportData = {
    // Property
    address:        m.address        ?? "",
    propertyType:   m.propertyType   ?? "",
    yearBuilt:      m.yearBuilt      ?? "",
    buildingArea:   m.buildingArea   ?? "",
    lotSize:        m.lotSize        ?? "",
    units:          m.units          ?? "",
    unitMix:        m.unitMix        ?? "",
    zoning:         m.zoning         ?? "",
    // Assessor
    assessedValue:  m.assessedValue  ?? "",
    landValue:      m.landValue      ?? "",
    improvements:   m.improvements   ?? "",
    taxRate:        m.taxRate        ?? "",
    annualTaxes:    m.annualTaxes    ?? "",
    parcelId:       m.parcelId       ?? "",
    assessorSource: m.assessorSource ?? "",
    // Deal inputs
    askingPrice:    m.askingPrice    ?? "",
    brokerCapRate:  m.brokerCapRate  ?? "",
    occupancy:      m.occupancy      ?? "",
    inPlaceRents:   m.inPlaceRents   ?? "",
    brokerClaims:   m.brokerClaims   ?? "",
    buyerCapRate:   m.buyerCapRate   ?? "",
    // Assumptions
    rates:       (() => { try { return m.rates ? JSON.parse(m.rates) : ["8.5","7.5","6.5","5.0"]; } catch { return ["8.5","7.5","6.5","5.0"]; } })(),
    ltvs:        (() => { try { return m.ltvs  ? JSON.parse(m.ltvs)  : ["75","50"]; } catch { return ["75","50"]; } })(),
    amortYears:  m.amortYears ?? "30",
    ioPeriod:    m.ioPeriod   ?? "0",
    // Revenue assumptions — unpacked from "vacancy,badDebt,otherIncomePct"
    vacancyPct:     m.revAssumptions ? (m.revAssumptions.split(",")[0] ?? "5.0") : "5.0",
    badDebtPct:     m.revAssumptions ? (m.revAssumptions.split(",")[1] ?? "1.0") : "1.0",
    otherIncomePct: m.revAssumptions ? (m.revAssumptions.split(",")[2] ?? "50")  : "50",
    // Sale history — unpacked from "price|year" (pipe separator)
    salePrice: m.saleInfo ? (m.saleInfo.split("|")[0] ?? "") : "",
    saleYear:  m.saleInfo ? (m.saleInfo.split("|")[1] ?? "") : "",
    // FEMA
    femaZone:    m.femaZone   ?? "",
    // Walk Score
    walkScore:   m.walkScore   ?? "",
    bikeScore:   m.bikeScore   ?? "",
    transitScore: m.transitScore ?? "",
    walkDesc:    m.walkDesc    ?? "",
    // Crime — new compact JSON format (crimeData) replaces old individual fields.
    // Old fields kept for backward compat with reports purchased before this change.
    crimeData:     m.crimeData     ?? "",
    crimeOverall:  m.crimeOverall  ?? "",
    crimeViolent:  m.crimeViolent  ?? "",
    crimeProp:     m.crimeProp     ?? "",
    crimeRate:     m.crimeRate     ?? "",
    crimeViolentRate: m.crimeViolentRate ?? "",
    crimePct:      m.crimePct      ?? "",
    // Census
    censusIncome:  m.censusIncome  ?? "",
    censusPop:     m.censusPop     ?? "",
    censusAge:     m.censusAge     ?? "",
    censusRent:    m.censusRent    ?? "",
    censusHomeVal: m.censusHomeVal ?? "",
    censusPoverty: m.censusPoverty ?? "",
    censusRenterPct:   m.censusRenterPct   ?? "",
    // Race — new format: censusRace="Black,Hispanic,White"; fallback to old individual keys
    censusPctBlack:    (m.censusRace ? m.censusRace.split(",")[0] : null) ?? m.censusPctBlack    ?? "",
    censusPctHispanic: (m.censusRace ? m.censusRace.split(",")[1] : null) ?? m.censusPctHispanic ?? "",
    censusPctWhite:    (m.censusRace ? m.censusRace.split(",")[2] : null) ?? m.censusPctWhite    ?? "",
    // Permits — may be split across two keys due to Stripe 500-char limit
    permitCount:   m.permitCount   ?? "0",
    permitSource:  m.permitSource  ?? "",
    permitDetails: (m.permitDetails ?? "") + (m.permitDetails2 ?? ""),
    // Schools
    schoolsData:   m.schoolsData   ?? "",
    // Proximity
    proximityMiles:   m.proximityMiles   ?? "",
    proximityMinutes: m.proximityMinutes ?? "",
    proximityCity:    m.proximityCity    ?? "",
    // MSA comparison
    msaName:    m.msaName    ?? "",
    msaIncome:  m.msaIncome  ?? "",
    msaHomeVal: m.msaHomeVal ?? "",
    msaRent:    m.msaRent    ?? "",
    msaPoverty: m.msaPoverty ?? "",
    // Census HH
    censusHouseholds:    m.censusHouseholds    ?? "",
    censusAvgHHSize:     m.censusAvgHHSize     ?? "",
    censusAvgRenterSize: m.censusAvgRenterSize ?? "",
    // HUD
    hudNearbyProps:   m.hudNearbyProps   ?? "",
    hudNearbyUnits:   m.hudNearbyUnits   ?? "",
    hudSection8Count: m.hudSection8Count ?? "",
    hudPropNames:     m.hudPropNames     ?? "",
    // BLS employment
    blsData: m.blsData ?? "",
    opexOverrides: m.opexOverrides ?? "",
  };

  let pdfBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = await renderToBuffer(React.createElement(DealBriefPDF, { data }) as any);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PDF render error:", msg, err);
    return NextResponse.json({ error: "PDF generation failed", detail: msg }, { status: 500 });
  }

  const slug = (data.address || "dealbrief").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dealbrief-${slug}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
