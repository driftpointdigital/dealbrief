import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Per-IP rate limit for this open endpoint (runs cost before the gate).
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT = 20;                  // runs per window per IP

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Returns true if the IP is OVER the limit. Fails OPEN on any DB error so a
// Supabase hiccup never blocks legitimate users.
async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const db = supabase();
    const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count } = await db
      .from("pipeline_hits")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= RATE_LIMIT) return true;
    await db.from("pipeline_hits").insert({ ip });
    // Opportunistic cleanup so the table stays small.
    if (Math.random() < 0.03) {
      const cutoff = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      await db.from("pipeline_hits").delete().lt("created_at", cutoff);
    }
    return false;
  } catch {
    return false;
  }
}

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

  if (await isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "You're running a lot of reports quickly. Please wait a few minutes and try again." },
      { status: 429 },
    );
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
