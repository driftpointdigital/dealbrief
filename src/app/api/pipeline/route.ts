import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { currentUserId } from "@/lib/supabase-server";
import { checkEligibility, claimRun } from "@/lib/runGate";

// This endpoint triggers the metered pipeline (Regrid / Google / Shovels /
// ScraperAPI spend) and returns the full dataset. It is gated:
//   1. Kill switch  — PIPELINE_DISABLED=1 hard-stops all runs.
//   2. Auth         — must have a signed-in session.
//   3. Eligibility  — free run available OR active subscription (checked
//                     BEFORE the backend call, so out-of-quota callers never
//                     spend).
//   4. Global cap   — PIPELINE_DAILY_CAP backstops a runaway/abuse loop.
//   5. Per-IP rate  — smooths bursts from a single client.
// The run is metered (claimRun) only AFTER the backend returns data, so a
// failed run never burns the user's quota.

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT = 20;                  // runs per window per IP
const GLOBAL_DAILY_CAP = Number(process.env.PIPELINE_DAILY_CAP || 500);

function killed(): boolean {
  const v = (process.env.PIPELINE_DISABLED || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

// On Vercel, x-real-ip is set to the true client IP by the platform and cannot
// be spoofed by the caller (unlike x-forwarded-for, whose first entry is
// attacker-controlled). Prefer it; fall back to the LAST x-forwarded-for hop.
function clientIp(req: NextRequest): string {
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return "unknown";
}

// True if today's total backend-bound calls have hit the global cap. Fails OPEN
// on any DB error so a Supabase hiccup never blocks legitimate users.
async function overGlobalDailyCap(): Promise<boolean> {
  try {
    const db = supabase();
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { count } = await db
      .from("pipeline_hits")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start.toISOString());
    return (count ?? 0) >= GLOBAL_DAILY_CAP;
  } catch {
    return false;
  }
}

// True if this IP is OVER the per-window limit. Also records the hit (which
// doubles as the global-cap counter). Fails OPEN on any DB error.
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

export async function POST(req: NextRequest) {
  const apiUrl = process.env.PIPELINE_API_URL;
  if (!apiUrl) {
    return NextResponse.json({ error: "PIPELINE_API_URL not configured" }, { status: 500 });
  }

  if (killed()) {
    return NextResponse.json(
      { error: "Reports are temporarily paused. Please try again shortly." },
      { status: 503 },
    );
  }

  // 1) Auth — no anonymous runs.
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "auth_required", reason: "auth" }, { status: 401 });
  }

  // 2) Eligibility — checked BEFORE the expensive call so out-of-quota callers
  //    never spend.
  const elig = await checkEligibility(userId);
  if (!elig.allowed) {
    return NextResponse.json({ error: "subscribe_required", reason: elig.reason }, { status: 402 });
  }

  // 3) Global daily cap (abuse / runaway backstop).
  if (await overGlobalDailyCap()) {
    return NextResponse.json(
      { error: "We've hit today's report capacity. Please try again tomorrow." },
      { status: 503 },
    );
  }

  // 4) Per-IP rate limit (also records the hit for the global counter).
  if (await isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: "You're running a lot of reports quickly. Please wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const body = await req.json();
  const address: string | null = typeof body?.address === "string" ? body.address : null;

  try {
    const res = await fetch(`${apiUrl}/pipeline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Shared secret so the Railway backend rejects direct hits. No-op until
        // PIPELINE_API_SECRET is set on BOTH Vercel and Railway.
        ...(process.env.PIPELINE_API_SECRET ? { "x-api-key": process.env.PIPELINE_API_SECRET } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(58000),
    });

    const data = await res.json();

    if (!res.ok) {
      // Backend failed — do NOT meter the run.
      return NextResponse.json(data, { status: res.status });
    }

    // 5) Meter the successful run (after delivery is guaranteed). If the claim
    //    itself finds the user is out of quota (race with a concurrent run),
    //    surface subscribe rather than handing over a free dataset.
    const claim = await claimRun(userId, address);
    if (!claim.ok) {
      return NextResponse.json({ error: "subscribe_required", reason: claim.reason }, { status: 402 });
    }

    return NextResponse.json({ ...data, _run: { kind: claim.kind } }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
