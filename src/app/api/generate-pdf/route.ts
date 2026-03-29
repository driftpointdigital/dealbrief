import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { DealBriefPDF, ReportData } from "@/lib/pdf-template";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session" }, { status: 400 });
  }

  // Verify payment
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
  }

  const m = session.metadata ?? {};

  const data: ReportData = {
    address: m.address ?? "",
    propertyType: m.propertyType ?? "",
    yearBuilt: m.yearBuilt ?? "",
    buildingArea: m.buildingArea ?? "",
    lotSize: m.lotSize ?? "",
    units: m.units ?? "",
    unitMix: m.unitMix ?? "",
    assessedValue: m.assessedValue ?? "",
    landValue: m.landValue ?? "",
    improvements: m.improvements ?? "",
    taxRate: m.taxRate ?? "",
    askingPrice: m.askingPrice ?? "",
    brokerCapRate: m.brokerCapRate ?? "",
    occupancy: m.occupancy ?? "",
    inPlaceRents: m.inPlaceRents ?? "",
    brokerClaims: m.brokerClaims ?? "",
    rates: m.rates ? JSON.parse(m.rates) : ["8.5", "7.5", "6.5", "5.0"],
    ltvs: m.ltvs ? JSON.parse(m.ltvs) : ["75", "50"],
    amortYears: m.amortYears ?? "30",
    ioPeriod: m.ioPeriod ?? "0",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(React.createElement(DealBriefPDF, { data }) as any);

  const slug = (data.address || "dealbrief").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60);
  const filename = `dealbrief-${slug}.pdf`;

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
