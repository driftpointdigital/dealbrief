import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog: Multifamily Investing Research & Due Diligence",
  description:
    "Practical guides on multifamily due diligence, permit history, tax reassessment, FEMA flood zones, debt service analysis, and market-specific research. Written for small multifamily investors.",
  alternates: { canonical: "https://www.getdealbrief.com/blog" },
  openGraph: {
    type: "website",
    url: "https://www.getdealbrief.com/blog",
    title: "DealBrief Blog: Multifamily Research & Due Diligence",
    description:
      "Practical guides on multifamily due diligence, permits, taxes, flood zones, and debt service analysis.",
  },
};

function formatDate(iso: string): string {
  // Display the date in the post's stated calendar day, not the
  // viewer's timezone. Frontmatter dates are intent, not instants.
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div style={{
      minHeight: "100vh", background: "#FAFAFA",
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <div style={{ padding: "14px 28px", borderBottom: "1px solid #E5E7EB", background: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: "#1D3557", letterSpacing: "-0.5px" }}>
            DEAL<span style={{ color: "#457B9D" }}>BRIEF</span>
          </span>
        </Link>
        <Link href="/" style={{
          fontSize: 13, color: "#1D3557", textDecoration: "none",
          fontFamily: "inherit", fontWeight: 500,
        }}>
          Get a report →
        </Link>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px" }}>
        <header style={{ marginBottom: 40 }}>
          <h1 style={{
            fontSize: 36, fontWeight: 600, color: "#111827", lineHeight: 1.2,
            margin: "0 0 12px", letterSpacing: "-0.5px",
          }}>
            Multifamily Research &amp; Due Diligence
          </h1>
          <p style={{ fontSize: 16, color: "#6B7280", lineHeight: 1.6, margin: 0 }}>
            Practical guides for small multifamily investors. Permits, taxes,
            flood zones, debt service, and market-specific research notes.
          </p>
        </header>

        {posts.length === 0 ? (
          <p style={{ color: "#9CA3AF", fontStyle: "italic" }}>
            No posts yet. Check back soon.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {posts.map((p) => (
              <li key={p.slug} style={{
                padding: "24px 0",
                borderBottom: "1px solid #E5E7EB",
              }}>
                <Link
                  href={`/blog/${p.slug}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 6, fontSize: 12, color: "#9CA3AF" }}>
                    <time dateTime={p.date}>{formatDate(p.date)}</time>
                    <span>·</span>
                    <span>{p.readingMinutes} min read</span>
                    {p.category && (<>
                      <span>·</span>
                      <span>{p.category}</span>
                    </>)}
                  </div>
                  <h2 style={{
                    fontSize: 20, fontWeight: 600, color: "#111827",
                    margin: "0 0 6px", lineHeight: 1.3, letterSpacing: "-0.3px",
                  }}>
                    {p.title}
                  </h2>
                  <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.55, margin: 0 }}>
                    {p.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "20px 28px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "center", gap: 20, fontSize: 12, color: "#9CA3AF" }}>
        <Link href="/" style={{ color: "#1D3557", textDecoration: "none", fontWeight: 500 }}>
          DealBrief home
        </Link>
        <Link href="/blog/rss.xml" style={{ color: "#1D3557", textDecoration: "none", fontWeight: 500 }}>
          RSS
        </Link>
      </div>
    </div>
  );
}
