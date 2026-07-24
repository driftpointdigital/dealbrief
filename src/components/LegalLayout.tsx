import Link from "next/link";
import React from "react";

// Shared shell for the static legal pages (Terms, Privacy, Refund). Server
// component — plain prose, matches the app's IBM Plex type.
export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", color: "#1F2937" }}>
      <div style={{ padding: "14px 28px", borderBottom: "1px solid #E5E7EB", background: "white" }}>
        <Link href="/" style={{ textDecoration: "none", fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: "#1D3557", letterSpacing: "-0.5px" }}>
          DEAL<span style={{ color: "#457B9D" }}>BRIEF</span>
        </Link>
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 96px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.5px", margin: "0 0 6px" }}>{title}</h1>
        <p style={{ fontSize: 13, color: "#9CA3AF", margin: "0 0 32px" }}>Last updated {lastUpdated}</p>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: "#374151" }}>{children}</div>
        <p style={{ fontSize: 13, color: "#9CA3AF", marginTop: 48, borderTop: "1px solid #E5E7EB", paddingTop: 20 }}>
          Questions? Email{" "}
          <a href="mailto:info@getdealbrief.com" style={{ color: "#457B9D" }}>info@getdealbrief.com</a>.
          {" "}<Link href="/" style={{ color: "#457B9D" }}>Back to DealBrief</Link>.
        </p>
      </div>
    </div>
  );
}

// Shared heading style for section titles inside legal pages.
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1F2937", margin: "32px 0 10px" }}>{children}</h2>;
}
