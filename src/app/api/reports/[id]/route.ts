/**
 * GET /api/reports/[id]
 *
 * Returns the stored pipeline payload for one of the user's saved reports, so
 * the client can re-render the Review & Adjust view. Ownership-scoped: the query
 * filters on user_id, so a user can only fetch their own reports.
 */
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabase()
    .from("report_runs")
    .select("address, report_data")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || !data.report_data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ address: data.address, report_data: data.report_data });
}
