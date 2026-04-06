import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { market, email } = await req.json();

  if (!market || typeof market !== "string" || !market.trim()) {
    return NextResponse.json({ error: "Missing market" }, { status: 400 });
  }

  const token   = process.env.AIRTABLE_TOKEN?.trim();
  const baseId  = process.env.AIRTABLE_BASE_ID?.trim();
  const table   = process.env.AIRTABLE_SUGGESTIONS_TABLE ?? "Market Suggestions";

  if (!token || !baseId) {
    // Silently succeed for the user — just log server-side so the UI isn't broken
    console.warn("suggest-market: AIRTABLE_TOKEN or AIRTABLE_BASE_ID not set");
    return NextResponse.json({ ok: true });
  }

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

    if (!res.ok) {
      const detail = await res.text();
      console.error("suggest-market: Airtable error", res.status, detail);
      // Still return ok to the user — don't surface Airtable errors in the UI
    }
  } catch (err) {
    console.error("suggest-market: fetch error", err);
  }

  return NextResponse.json({ ok: true });
}
