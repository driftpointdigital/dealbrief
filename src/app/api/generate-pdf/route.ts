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
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
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
    zoning:         m.zoning         ?? "",
    // Assessor
    assessedValue:  m.assessedValue  ?? "",
    landValue:      m.landValue      ?? "",
    improvements:   m.improvements   ?? "",
    otherValue:     m.otherValue     ?? "",
    lpv:            m.lpv            ?? "",
    adjustedLpv:    m.adjustedLpv    ?? "",
    assessmentRatio: m.assessmentRatio ?? "",
    reappraisalYear: m.reappraisalYear ?? "",
    taxRate:        m.taxRate        ?? "",
    annualTaxes:    m.annualTaxes    ?? "",
    taxFeePerUnit:  m.taxFeePerUnit  ?? "",
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
    // Walk Score — new: wsData="walk|bike|transit|desc"; fallback to old individual keys
    walkScore:    m.wsData ? (m.wsData.split("|")[0] ?? "") : (m.walkScore    ?? ""),
    bikeScore:    m.wsData ? (m.wsData.split("|")[1] ?? "") : (m.bikeScore    ?? ""),
    transitScore: m.wsData ? (m.wsData.split("|")[2] ?? "") : (m.transitScore ?? ""),
    walkDesc:     m.wsData ? (m.wsData.split("|")[3] ?? "") : (m.walkDesc     ?? ""),
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
    // Race + education — new format: censusRace="Black,Hispanic,White,BachPlus"; fallback to old individual keys
    censusPctBlack:    (m.censusRace ? m.censusRace.split(",")[0] : null) ?? m.censusPctBlack    ?? "",
    censusPctHispanic: (m.censusRace ? m.censusRace.split(",")[1] : null) ?? m.censusPctHispanic ?? "",
    censusPctWhite:    (m.censusRace ? m.censusRace.split(",")[2] : null) ?? m.censusPctWhite    ?? "",
    censusBachPlus:    (m.censusRace ? m.censusRace.split(",")[3] : null) ?? "",
    // Permits — may be split across up to 4 keys due to Stripe 500-char limit
    permitCount:   m.permitCount   ?? "0",
    permitSource:  m.permitSource  ?? "",
    permitDetails: (m.permitDetails ?? "") + (m.permitDetails2 ?? "") + (m.permitDetails3 ?? "") + (m.permitDetails4 ?? ""),
    // Schools
    schoolsData:   m.schoolsData   ?? "",
    // Proximity — new: proxData="miles|minutes|city"; fallback to old individual keys
    proximityMiles:   m.proxData ? (m.proxData.split("|")[0] ?? "") : (m.proximityMiles   ?? ""),
    proximityMinutes: m.proxData ? (m.proxData.split("|")[1] ?? "") : (m.proximityMinutes ?? ""),
    proximityCity:    m.proxData ? (m.proxData.split("|")[2] ?? "") : (m.proximityCity    ?? ""),
    // MSA comparison — new: msaJ=JSON; fallback to old individual keys
    ...(() => {
      const msa = m.msaJ ? (() => { try { return JSON.parse(m.msaJ); } catch { return {}; } })() : {};
      return {
        msaName:      msa.n ?? m.msaName    ?? "",
        msaIncome:    msa.i ?? m.msaIncome  ?? "",
        msaHomeVal:   msa.h ?? m.msaHomeVal ?? "",
        msaRent:      msa.r ?? m.msaRent    ?? "",
        msaPoverty:   msa.p ?? m.msaPoverty ?? "",
        msaBachPlus:  msa.b != null ? String(msa.b) : "",
      };
    })(),
    // Census HH — new: censusHH="households|avgHH|avgRenter"; fallback to old individual keys
    censusHouseholds:    m.censusHH ? (m.censusHH.split("|")[0] ?? "") : (m.censusHouseholds    ?? ""),
    censusAvgHHSize:     m.censusHH ? (m.censusHH.split("|")[1] ?? "") : (m.censusAvgHHSize     ?? ""),
    censusAvgRenterSize: m.censusHH ? (m.censusHH.split("|")[2] ?? "") : (m.censusAvgRenterSize ?? ""),
    // HUD — new: hudJ=JSON; fallback to old individual keys
    ...(() => {
      const hud = m.hudJ ? (() => { try { return JSON.parse(m.hudJ); } catch { return {}; } })() : {};
      return {
        hudNearbyProps:   hud.p  != null ? String(hud.p)  : (m.hudNearbyProps   ?? ""),
        hudNearbyUnits:   hud.u  != null ? String(hud.u)  : (m.hudNearbyUnits   ?? ""),
        hudSection8Count: hud.s8 != null ? String(hud.s8) : (m.hudSection8Count ?? ""),
        hudPropNames:     hud.n  != null ? String(hud.n)  : (m.hudPropNames     ?? ""),
      };
    })(),
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

  const streetAddress = (data.address || "").split(",")[0].trim() || "dealbrief";
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
