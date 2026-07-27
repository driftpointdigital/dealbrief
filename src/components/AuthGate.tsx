"use client";
// The gate shown BEFORE the pipeline runs. Signed-out visitors sign up (which
// grants 1 free run) or log in; if they've used their free run and have no
// active subscription, they subscribe. Once authed AND eligible we call
// onReady, and the parent re-invokes the pipeline (which now authorizes + meters
// the run server-side). The gate never sees or claims report data itself.
//
// Subscribe flow stashes the pending ADDRESS so that after the Stripe redirect
// the user lands back on the gate; we poll the account until the subscription
// webhook has synced, then onReady re-runs that address.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { sendGAEvent } from "@next/third-parties/google";
import { useAuth } from "@/lib/auth-context";

// Fire a Reddit Ads pixel conversion if the pixel is present.
function rdtTrack(event: string) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { rdt?: (...args: unknown[]) => void };
  if (typeof w.rdt === "function") w.rdt("track", event);
}

const NAVY = "#1D3557", SLATE = "#457B9D", INK = "#111827", MUTE = "#6B7280", RULE = "#E5E7EB", RED = "#C0392B";
const SANS = "'IBM Plex Sans', -apple-system, sans-serif";

export default function AuthGate({
  address,
  forceSubscribe = false,
  justSubscribed = false,
  loginOnly = false,
  onReady,
  onBack,
}: {
  address: string;
  forceSubscribe?: boolean;  // 402: authed but out of runs — open in subscribe mode
  justSubscribed?: boolean;  // returned from Stripe checkout — poll for sync
  loginOnly?: boolean;       // standalone "Log in" from the homepage — no address/run, just authenticate
  onReady: () => void;       // authed AND eligible — parent re-runs the pipeline (or, loginOnly: authed)
  onBack: () => void;
}) {
  const { user, account, accountLoading, refreshAccount, signInWithPassword, signUpWithPassword } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">(loginOnly ? "login" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needSubscribe, setNeedSubscribe] = useState(forceSubscribe);
  const readyRef = useRef(false);
  const activateAttemptsRef = useRef(0);

  const fireReady = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady();
  }, [onReady]);

  // Once authed and the account summary has loaded: if eligible, hand back to
  // the parent to run; if we just returned from Stripe, poll until the
  // subscription syncs; else prompt subscribe.
  useEffect(() => {
    // Standalone login (homepage "Log in"): authenticate and hand back as soon
    // as the user exists — no eligibility/subscribe gating, no address to run.
    if (loginOnly) {
      if (user) fireReady();
      return;
    }
    if (!user || accountLoading || account === null || needSubscribe) return;
    if (account.canRun) {
      fireReady();
      return;
    }
    if (justSubscribed && activateAttemptsRef.current < 10) {
      activateAttemptsRef.current += 1;
      const t = setTimeout(() => refreshAccount(), 1500);
      return () => clearTimeout(t);
    }
    setNeedSubscribe(true);
  }, [user, account, accountLoading, needSubscribe, justSubscribed, fireReady, refreshAccount, loginOnly]);

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and a password.");
      return;
    }
    setError("");
    setBusy(true);
    const fn = mode === "signup" ? signUpWithPassword : signInWithPassword;
    const { error } = await fn(email.trim().toLowerCase(), password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (mode === "signup") {
      sendGAEvent("event", "account_created", {});
      rdtTrack("SignUp");
    }
    await refreshAccount();
  };

  const subscribe = async () => {
    setBusy(true);
    setError("");
    try {
      // Stash the pending address so we can re-run it after Stripe returns.
      if (address && typeof window !== "undefined") {
        sessionStorage.setItem("db_pending_address", address);
      }
      const res = await fetch("/api/subscribe", { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j.error || "Could not start checkout");
      sendGAEvent("event", "subscribe_start", {});
      window.location.href = j.url;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Could not start checkout");
    }
  };

  const claimingNow = !!user && !needSubscribe && (accountLoading || readyRef.current || !!account?.canRun);
  const activating = !!user && justSubscribed && !needSubscribe && !account?.canRun && !claimingNow;

  const input: React.CSSProperties = {
    width: "100%", padding: "10px 12px", fontSize: 14, border: `1px solid ${RULE}`,
    borderRadius: 8, fontFamily: SANS, marginBottom: 10, boxSizing: "border-box",
  };
  const primaryBtn: React.CSSProperties = {
    width: "100%", padding: "11px 16px", fontSize: 14, fontWeight: 600, color: "white",
    background: NAVY, border: "none", borderRadius: 8, cursor: busy ? "default" : "pointer",
    fontFamily: SANS, opacity: busy ? 0.7 : 1,
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 20px 24px", background: "rgba(248,250,252,0.35)", fontFamily: SANS, color: INK, overflowY: "auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ background: "white", border: `1px solid ${RULE}`, borderRadius: 12, padding: "28px 26px", boxShadow: "0 16px 48px rgba(15,31,56,0.22)" }}>
          {loginOnly ? (
            <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 20 }}>Log in to your account</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: MUTE, marginBottom: 4 }}>Your report for</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 20 }}>{address || "your property"}</div>
            </>
          )}

          {activating ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 14, color: NAVY, fontWeight: 600 }}>Activating your subscription…</div>
              <div style={{ fontSize: 12.5, color: MUTE, marginTop: 8 }}>This takes a few seconds after checkout.</div>
            </div>
          ) : claimingNow ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 14, color: NAVY, fontWeight: 600 }}>Preparing your report…</div>
              {error ? <div style={{ fontSize: 12.5, color: RED, marginTop: 10 }}>{error}</div> : null}
            </div>
          ) : needSubscribe ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginBottom: 6 }}>You&apos;ve used your free report</div>
              <div style={{ fontSize: 13, color: MUTE, lineHeight: 1.5, marginBottom: 16 }}>
                Subscribe for <strong style={{ color: INK }}>$29/mo</strong>. 20 reports included, then $2 each. <span style={{ fontWeight: 700, textDecoration: "underline", color: INK }}>First 14 days or 10 reports free.</span>
              </div>
              <button onClick={subscribe} disabled={busy} style={primaryBtn}>
                {busy ? "Starting checkout…" : "Subscribe & unlock →"}
              </button>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8, lineHeight: 1.5 }}>
                Billed $29/month and auto-renews until canceled. Cancel anytime from your account. $2 per report beyond 20/month.
              </div>
              {error ? <div style={{ fontSize: 12.5, color: RED, marginTop: 10 }}>{error}</div> : null}
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 4, background: "#F1F5F9", borderRadius: 8, padding: 3, marginBottom: 16 }}>
                {(["signup", "login"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(""); }}
                    style={{
                      flex: 1, padding: "7px 0", fontSize: 13, fontWeight: 600, borderRadius: 6, cursor: "pointer",
                      border: "none", fontFamily: SANS,
                      background: mode === m ? "white" : "transparent",
                      color: mode === m ? NAVY : MUTE,
                      boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    {m === "signup" ? "First report — free" : "Log in"}
                  </button>
                ))}
              </div>

              <form onSubmit={submitAuth}>
                <input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} style={input} autoComplete="email" />
                <input type="password" placeholder={mode === "signup" ? "Create a password" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} style={input} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                <button type="submit" disabled={busy} style={primaryBtn}>
                  {busy ? "Working…" : mode === "signup" ? "Get my free report →" : "Log in →"}
                </button>
              </form>
              {error ? <div style={{ fontSize: 12.5, color: RED, marginTop: 10 }}>{error}</div> : null}
              <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 14, lineHeight: 1.5 }}>
                {mode === "signup"
                  ? "One free report per account. No card required."
                  : "Existing subscribers: log in to run against your plan."}
              </div>
            </>
          )}
        </div>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 13, color: MUTE, cursor: "pointer", fontFamily: SANS }}>{loginOnly ? "Cancel" : "← New search"}</button>
        </div>
      </div>
    </div>
  );
}
