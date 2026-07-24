/**
 * GET /api/reports
 *
 * Lists the signed-in user's saved reports (most recent first). Only runs that
 * persisted a payload (report_data not null) are revisitable, so we filter to
 * those. Returns lightweight rows (id, address, created_at) for the list view.
 */
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase()
    .from("report_runs")
    .select("id, address, created_at")
    .eq("user_id", userId)
    .not("report_data", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("reports list error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
  return NextResponse.json({ reports: data ?? [] });
}
