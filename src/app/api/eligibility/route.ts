/**
 * POST /api/eligibility
 *
 * Body: { email: string }
 *
 * Returns { free: boolean }. `free` is true iff this email has NOT yet
 * received a free report. Used by the client to decide whether to route
 * the user to /api/free-report or /api/checkout.
 *
 * This is advisory only — the authoritative check happens inside
 * /api/free-report (where the unique index on reports.email catches the
 * race condition of two near-simultaneous submissions). The client
 * still needs a fallback path for "you qualified at check-time but
 * raced another tab" — see the conflict handling in /api/free-report.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase, normalizeEmail, isPlausibleEmail } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const raw = (body as { email?: unknown })?.email;
  if (typeof raw !== "string" || !isPlausibleEmail(raw)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = normalizeEmail(raw);

  try {
    const { data, error } = await supabase()
      .from("reports")
      .select("id")
      .eq("email", email)
      .limit(1);
    if (error) {
      console.error("eligibility supabase error:", error);
      // Fail closed: if we can't verify, treat as paid (don't accidentally
      // hand out free reports during a DB outage).
      return NextResponse.json({ free: false });
    }
    return NextResponse.json({ free: (data ?? []).length === 0 });
  } catch (err) {
    console.error("eligibility unexpected error:", err);
    return NextResponse.json({ free: false });
  }
}
