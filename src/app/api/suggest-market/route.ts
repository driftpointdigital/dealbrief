import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { market, email } = await req.json();

  if (!market || typeof market !== "string" || !market.trim()) {
    return NextResponse.json({ error: "Missing market" }, { status: 400 });
  }

  const token   = process.env.AIRTABLE_TOKEN?.trim();
  const baseId  = process.env.AIRTABLE_BASE_ID?.trim();
  const table   = process.env.AIRTABLE_SUGGESTIONS_TABLE ?? "Market Suggestions";
  const isDebug = (req as NextRequest & { _debugKey?: string }).nextUrl?.searchParams?.get("_dbg") === "db-dev-39689a7e3a59";

  if (!token || !baseId) {
    console.warn("suggest-market: AIRTABLE_TOKEN or AIRTABLE_BASE_ID not set");
    return NextResponse.json(isDebug ? { ok: true, _d: "env_missing" } : { ok: true });
  }

  let airtableStatus = 0;
  let airtableDetail = "";
  try {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          Market:           market.trim(),
          "Submitted At":   new Date().toISOString(),
          ...(email && typeof email === "string" && email.trim()
            ? { "Submitted By": email.trim() }
            : {}),
        },
      }),
    });
    airtableStatus = res.status;
    if (!res.ok) {
      airtableDetail = await res.text();
      console.error("suggest-market: Airtable error", res.status, airtableDetail);
    }
  } catch (err) {
    airtableDetail = String(err);
    console.error("suggest-market: fetch error", err);
  }

  return NextResponse.json(isDebug
    ? { ok: true, _d: "done", _s: airtableStatus, _base: baseId, _table: table, _err: airtableDetail || null }
    : { ok: true });
}
