"use client";
// Signed-in account dropdown: shows the user's email + plan/usage, opens the
// Stripe Customer Portal to manage or cancel the subscription, and signs out.
// Renders nothing when logged out.
import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const NAVY = "#1D3557", INK = "#111827", MUTE = "#6B7280", RULE = "#E5E7EB", RED = "#C0392B";

export default function AccountMenu({ dark = false }: { dark?: boolean }) {
  const { user, account, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!user) return null;

  const email = account?.email || user.email || "Account";
  const sub = account?.subscription;
  const statusLabel = sub
    ? sub.status === "trialing" ? "Trialing"
      : sub.status === "active" ? "Active"
      : sub.status === "past_due" ? "Past due"
      : sub.status
    : account?.freeRunAvailable ? "Free run available" : "No subscription";

  const manageBilling = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const j = await res.json();
      if (res.ok && j.url) { window.location.href = j.url; return; }
      setErr(j.error || "Billing portal unavailable");
    } catch {
      setErr("Network error");
    }
    setBusy(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "none", border: "none", fontSize: 13, cursor: "pointer",
          fontFamily: "inherit", color: dark ? "#374151" : "#6B7280",
          display: "flex", alignItems: "center", gap: 4, maxWidth: 200,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
        <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open ? (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: "white", border: `1px solid ${RULE}`, borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", padding: 14, minWidth: 236, zIndex: 50, fontFamily: "inherit" }}>
            <div style={{ fontSize: 11, color: MUTE }}>Signed in as</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK, marginBottom: 10, wordBreak: "break-all" }}>{email}</div>
            <div style={{ fontSize: 11, color: MUTE }}>Plan</div>
            <div style={{ fontSize: 13, color: INK }}>{statusLabel}</div>
            {sub ? (
              <div style={{ fontSize: 11.5, color: MUTE, marginTop: 2, marginBottom: 10 }}>
                {(account?.runsThisPeriod ?? 0)} / {sub.includedRuns} reports this period
              </div>
            ) : <div style={{ height: 10 }} />}
            {sub ? (
              <button onClick={manageBilling} disabled={busy} style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontWeight: 600, background: NAVY, color: "white", border: "none", borderRadius: 6, cursor: busy ? "default" : "pointer", marginBottom: 6, opacity: busy ? 0.7 : 1 }}>
                {busy ? "Opening…" : "Manage / cancel subscription →"}
              </button>
            ) : null}
            <button onClick={() => { signOut(); setOpen(false); }} style={{ width: "100%", padding: "9px 12px", fontSize: 13, background: "none", color: MUTE, border: `1px solid ${RULE}`, borderRadius: 6, cursor: "pointer" }}>
              Sign out
            </button>
            {err ? <div style={{ fontSize: 11.5, color: RED, marginTop: 8 }}>{err}</div> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
