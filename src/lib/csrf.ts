import { NextResponse } from "next/server";

// Reject cross-site state-changing requests (billing mutations). Supabase's
// session cookies are SameSite=Lax, which already blocks the classic CSRF
// vector; this is an explicit belt-and-suspenders Origin check.
//
// A same-origin fetch() always sends an Origin header. If Origin is present and
// its host doesn't match the request host, reject. If Origin is absent (rare
// for fetch; e.g. a top-level navigation that can't carry a cross-site JSON
// body), we allow — there's nothing to forge.
export function rejectCrossOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = req.headers.get("host");
  try {
    if (host && new URL(origin).host === host) return null;
  } catch {
    // malformed Origin — fall through to reject
  }
  return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
}
