"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [status, setStatus] = useState<"verifying" | "ready" | "error">("verifying");
  const [address, setAddress] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Verify payment by hitting the generate endpoint with HEAD-style probe
    fetch(`/api/generate-pdf?session=${sessionId}`, { method: "HEAD" })
      .then(res => {
        if (res.ok || res.status === 200) setStatus("ready");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));

    // Pull address from Stripe session for display
    fetch(`/api/session-meta?session=${sessionId}`)
      .then(r => r.json())
      .then(d => { if (d.address) setAddress(d.address); })
      .catch(() => {});
  }, [sessionId]);

  const download = async () => {
    setDownloading(true);
    const res = await fetch(`/api/generate-pdf?session=${sessionId}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const streetPart = (address || "").split(",")[0].trim();
    a.download = streetPart ? `DealBrief - ${streetPart}.pdf` : "DealBrief.pdf";
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#FAFAFA",
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <div style={{ padding: "14px 28px", borderBottom: "1px solid #E5E7EB", background: "white", display: "flex", alignItems: "center" }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: "#1D3557", letterSpacing: "-0.5px" }}>
            DEAL<span style={{ color: "#457B9D" }}>BRIEF</span>
          </span>
        </a>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>

          {status === "verifying" && (
            <>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid #E5E7EB", borderTopColor: "#1D3557", margin: "0 auto 24px", animation: "spin 0.8s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ fontSize: 15, color: "#6B7280", margin: 0 }}>Verifying payment…</p>
            </>
          )}

          {status === "ready" && (
            <>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M5 11L9.5 15.5L17 7" stroke="#2D8C4E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.3px" }}>
                Your DealBrief is ready.
              </h1>
              {address && (
                <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 28px" }}>{address}</p>
              )}
              <button
                onClick={download}
                disabled={downloading}
                style={{
                  padding: "13px 36px", fontSize: 15, fontWeight: 500,
                  background: downloading ? "#9CA3AF" : "#1D3557",
                  color: "white", border: "none", borderRadius: 6,
                  cursor: downloading ? "not-allowed" : "pointer",
                  fontFamily: "inherit", letterSpacing: "-0.1px",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { if (!downloading) e.currentTarget.style.background = "#152A47"; }}
                onMouseLeave={e => { if (!downloading) e.currentTarget.style.background = "#1D3557"; }}
              >
                {downloading ? "Generating PDF…" : "Download DealBrief"}
              </button>
              <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 16 }}>
                You can download this report again using this page URL.
              </p>
              <p style={{ fontSize: 13, color: "#374151", marginTop: 12, lineHeight: 1.5, maxWidth: 420, textAlign: "center", margin: "12px auto 0" }}>
                This product is in beta testing. If you have any issues whatsoever, contact us at{" "}
                <a href="mailto:info@dealbrief.com" style={{ color: "#1D3557", fontWeight: 600 }}>info@dealbrief.com</a>
                {" "}and we'll make it right.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: "0 0 10px" }}>
                Something went wrong.
              </h1>
              <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 24px" }}>
                Payment may still be processing, or the session has expired. Try refreshing in a moment.
              </p>
              <button onClick={() => window.location.reload()} style={{
                padding: "10px 24px", fontSize: 14, background: "none",
                border: "1.5px solid #D1D5DB", borderRadius: 6, cursor: "pointer",
                fontFamily: "inherit", color: "#374151",
              }}>
                Retry
              </button>
              <p style={{ fontSize: 13, color: "#6B7280", marginTop: 24 }}>
                Problem with your report?{" "}
                <a href="mailto:info@getdealbrief.com" style={{ color: "#1D3557", textDecoration: "none", fontWeight: 500 }}>
                  Contact us
                </a>{" "}
                and we'll make it right.
              </p>
            </>
          )}

        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "16px 28px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "center", gap: 20 }}>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>
          Questions or issues?{" "}
          <a
            href="mailto:info@getdealbrief.com"
            style={{ color: "#1D3557", textDecoration: "none", fontWeight: 500 }}
          >
            info@getdealbrief.com
          </a>
        </span>
      </div>
    </div>
  );
}
