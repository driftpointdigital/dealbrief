import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { DealBriefPDF } from "@/lib/pdf-template";
import { metadataToReportData } from "@/lib/metadataToReportData";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

const FREE_PREFIX = "free-";

/**
 * Loads the compact report metadata for a given id. Returns null if the
 * id is invalid or — for paid sessions — payment hasn't completed yet.
 */
async function loadMetadata(
  id: string
): Promise<Record<string, string> | null> {
  if (id.startsWith(FREE_PREFIX)) {
    const uuid = id.slice(FREE_PREFIX.length);
    const { data, error } = await supabase()
      .from("reports")
      .select("metadata")
      .eq("id", uuid)
      .eq("source", "free")
      .single();
    if (error || !data) return null;
    // JSONB comes back as an arbitrary object; we know it's the
    // Record<string,string> shape that buildReportMetadata wrote.
    return data.metadata as Record<string, string>;
  }

  // Paid path — resolve via Stripe.
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await stripe.checkout.sessions.retrieve(id);
  if (
    session.payment_status !== "paid" &&
    session.payment_status !== "no_payment_required"
  ) {
    return null;
  }
  return (session.metadata ?? {}) as Record<string, string>;
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session");
  if (!sessionId) return NextResponse.json({ error: "Missing session" }, { status: 400 });

  let metadata: Record<string, string> | null;
  try {
    metadata = await loadMetadata(sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("generate-pdf load error:", msg);
    return NextResponse.json({ error: "Could not load report" }, { status: 500 });
  }
  if (!metadata) {
    return NextResponse.json({ error: "Not found or payment not completed" }, { status: 402 });
  }

  const data = metadataToReportData(metadata);

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
