import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // allow up to 60s for pipeline (Vercel Pro cap).
                               // Some collectors (Shovels geo_id resolution,
                               // CrimeGrade scraper, Florida PA FDOR spatial)
                               // intermittently hit their 20s timeouts; the
                               // pipeline's parallel gather waits on the
                               // slowest. 30s wasn't enough headroom.

export async function POST(req: NextRequest) {
  const apiUrl = process.env.PIPELINE_API_URL;
  if (!apiUrl) {
    return NextResponse.json({ error: "PIPELINE_API_URL not configured" }, { status: 500 });
  }

  const body = await req.json();

  try {
    const res = await fetch(`${apiUrl}/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(58000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
