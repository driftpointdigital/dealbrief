/**
 * POST /api/free-report
 *
 * Atomically claims the email's free-report credit and stores the
 * compact report metadata in Supabase. Returns { id: "free-<uuid>" }
 * on success.
 *
 * 409 Conflict: this email has already received a free report. The
 * caller should fall back to /api/checkout. The unique index
 * `reports_one_free_per_email` (DDL in chat thread) guarantees this
 * even if /api/eligibility said "free" moments earlier.
 *
 * GET /api/free-report?id=free-<uuid>
 *
 * Resolves a free-report id to its stored metadata. Used by
 * /api/generate-pdf and /api/session-meta when the id is a free-uuid
 * rather than a Stripe checkout session id.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabase, normalizeEmail, isPlausibleEmail } from "@/lib/supabase";
import { buildReportMetadata } from "@/lib/buildReportMetadata";

const FREE_PREFIX = "free-";

function isFreeId(id: string): boolean {
  return id.startsWith(FREE_PREFIX);
}

function stripPrefix(id: string): string {
  return id.startsWith(FREE_PREFIX) ? id.slice(FREE_PREFIX.length) : id;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawEmail = body.email;
  if (typeof rawEmail !== "string" || !isPlausibleEmail(rawEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = normalizeEmail(rawEmail);

  const metadata = buildReportMetadata(body);

  try {
    const { data, error } = await supabase()
      .from("reports")
      .insert({ email, source: "free", metadata })
      .select("id")
      .single();

    if (error) {
      // Postgres unique-violation = 23505. Surfaces as a duplicate-key
      // error from PostgREST.
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        return NextResponse.json(
          { error: "Email has already used its free report" },
          { status: 409 }
        );
      }
      console.error("free-report insert error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ id: `${FREE_PREFIX}${data.id}` });
  } catch (err) {
    console.error("free-report unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !isFreeId(id)) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }
  const uuid = stripPrefix(id);

  try {
    const { data, error } = await supabase()
      .from("reports")
      .select("metadata")
      .eq("id", uuid)
      .eq("source", "free")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ metadata: data.metadata });
  } catch (err) {
    console.error("free-report GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
