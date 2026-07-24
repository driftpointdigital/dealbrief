"use client";
// The report library — lists the signed-in user's saved reports. Clicking one
// opens it back in Review & Adjust (via /?report=<id>, handled on mount in
// DealBrief). Reports live in report_runs.report_data (persisted on each run).
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import AccountMenu from "@/components/AccountMenu";

const NAVY = "#1D3557", SLATE = "#457B9D", INK = "#111827", MUTE = "#6B7280", RULE = "#E5E7EB";

type Row = { id: string; address: string | null; created_at: string };

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function ReportsPage() {
  const { user, accountLoading } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/reports")
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) { setErr("Could not load your reports."); setRows([]); return; }
        const j = await r.json();
        setRows((j.reports ?? []) as Row[]);
      })
      .catch(() => { if (alive) { setErr("Network error."); setRows([]); } });
    return () => { alive = false; };
  }, [user]);

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", color: INK }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ padding: "14px 28px", borderBottom: `1px solid ${RULE}`, background: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/" style={{ textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: NAVY, letterSpacing: "-0.5px" }}>
          DEAL<span style={{ color: SLATE }}>BRIEF</span>
        </Link>
        <AccountMenu />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.4px", margin: "0 0 4px" }}>Your reports</h1>
        <p style={{ fontSize: 14, color: MUTE, margin: "0 0 24px" }}>Every address you&apos;ve run. Open one to review and adjust it again.</p>

        {!user && !accountLoading ? (
          <div style={{ background: "white", border: `1px solid ${RULE}`, borderRadius: 10, padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: MUTE, margin: "0 0 14px" }}>Log in to see your saved reports.</p>
            <Link href="/" style={{ fontSize: 14, color: SLATE, fontWeight: 600, textDecoration: "none" }}>Go to DealBrief →</Link>
          </div>
        ) : rows === null ? (
          <div style={{ fontSize: 14, color: MUTE }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ background: "white", border: `1px solid ${RULE}`, borderRadius: 10, padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: MUTE, margin: "0 0 14px" }}>{err || "No reports yet. Run your first address to see it here."}</p>
            <Link href="/" style={{ fontSize: 14, color: SLATE, fontWeight: 600, textDecoration: "none" }}>Run a report →</Link>
          </div>
        ) : (
          <div style={{ background: "white", border: `1px solid ${RULE}`, borderRadius: 10, overflow: "hidden" }}>
            {rows.map((r, i) => (
              <Link
                key={r.id}
                href={`/?report=${r.id}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "14px 18px", textDecoration: "none", color: INK,
                  borderTop: i === 0 ? "none" : `1px solid ${RULE}`,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.address || "Untitled report"}
                </span>
                <span style={{ fontSize: 12.5, color: MUTE, whiteSpace: "nowrap" }}>{fmtDate(r.created_at)} ›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
