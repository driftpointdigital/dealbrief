import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";

const SITE = "https://www.getdealbrief.com";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  const canonical = `${SITE}/blog/${post.slug}`;
  const ogImage = post.ogImage
    ? (post.ogImage.startsWith("http") ? post.ogImage : `${SITE}${post.ogImage}`)
    : `${SITE}/opengraph-image`;
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: canonical,
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      authors: post.author ? [post.author] : ["DealBrief"],
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [ogImage],
    },
  };
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

export default async function BlogPostPage({ params }: RouteParams) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const canonical = `${SITE}/blog/${post.slug}`;
  const ogImage = post.ogImage
    ? (post.ogImage.startsWith("http") ? post.ogImage : `${SITE}${post.ogImage}`)
    : `${SITE}/opengraph-image`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: canonical,
    datePublished: post.date,
    dateModified: post.date,
    image: ogImage,
    author: {
      "@type": "Organization",
      name: post.author ?? "DealBrief",
      url: SITE,
    },
    publisher: {
      "@type": "Organization",
      name: "DealBrief",
      url: SITE,
      logo: { "@type": "ImageObject", url: `${SITE}/opengraph-image` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    keywords: (post.keywords ?? []).join(", "),
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#FAFAFA",
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

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

      <article style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px 64px" }}>
        <Link href="/blog" style={{
          fontSize: 13, color: "#457B9D", textDecoration: "none",
          fontFamily: "inherit", fontWeight: 500, display: "inline-block", marginBottom: 24,
        }}>
          ← All posts
        </Link>

        <header style={{
          marginBottom: 40, paddingBottom: 32,
          borderBottom: "1px solid #E5E7EB",
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, fontSize: 13, color: "#6B7280" }}>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span>·</span>
            <span>{post.readingMinutes} min read</span>
            {post.category && (<>
              <span>·</span>
              <span>{post.category}</span>
            </>)}
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 600, color: "#111827",
            margin: "0 0 16px", lineHeight: 1.2, letterSpacing: "-0.5px",
          }}>
            {post.title}
          </h1>
          <p style={{
            fontSize: 18, color: "#6B7280", lineHeight: 1.5,
            margin: 0, fontWeight: 300,
          }}>
            {post.description}
          </p>
        </header>

        <div
          className="post-body"
          style={{
            fontSize: 16, color: "#1F2937", lineHeight: 1.7,
          }}
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {/* CTA */}
        <div style={{
          marginTop: 56, padding: "24px 28px", borderRadius: 8,
          border: "1px solid #1D3557", background: "white",
        }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "#1D3557", margin: "0 0 8px" }}>
            Or get all of this in one report.
          </h3>
          <p style={{ fontSize: 14, color: "#374151", margin: "0 0 14px", lineHeight: 1.55 }}>
            Enter a multifamily address. DealBrief pulls tax assessment,
            permits, flood zone, crime, demographics, debt service, and more
            into a live, editable report you can adjust and export. Your first
            report is free.
          </p>
          <Link href="/" style={{
            display: "inline-block", padding: "10px 22px", fontSize: 14, fontWeight: 500,
            background: "#1D3557", color: "white", borderRadius: 6, textDecoration: "none",
            fontFamily: "inherit",
          }}>
            Run a brief →
          </Link>
        </div>
      </article>

      {/* Inline styles for rendered markdown body. Tailwind Typography
          would be overkill for one page. */}
      <style>{`
        .post-body h2 {
          font-size: 22px; font-weight: 600; color: #1D3557;
          margin: 40px 0 12px; line-height: 1.3; letter-spacing: -0.3px;
        }
        .post-body h3 {
          font-size: 18px; font-weight: 600; color: #111827;
          margin: 32px 0 10px; line-height: 1.35;
        }
        .post-body p { margin: 0 0 18px; }
        .post-body ul, .post-body ol { margin: 0 0 18px; padding-left: 24px; }
        .post-body li { margin-bottom: 8px; }
        .post-body a { color: #1D3557; text-decoration: underline; }
        .post-body a:hover { color: #152A47; }
        .post-body code {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 14px;
          background: #F1F5F9; padding: 2px 6px; border-radius: 3px;
        }
        .post-body pre {
          background: #F8FAFC; border: 1px solid #E5E7EB;
          border-radius: 6px; padding: 16px; overflow-x: auto;
          font-size: 13px; line-height: 1.5; margin: 0 0 18px;
        }
        .post-body pre code { background: transparent; padding: 0; }
        .post-body blockquote {
          border-left: 3px solid #457B9D; padding: 4px 0 4px 16px;
          color: #374151; margin: 0 0 18px; font-style: italic;
        }
        .post-body table {
          width: 100%; border-collapse: collapse; margin: 0 0 18px;
          font-size: 14px;
        }
        .post-body th, .post-body td {
          border: 1px solid #E5E7EB; padding: 8px 12px; text-align: left;
        }
        .post-body th { background: #F8FAFC; font-weight: 600; }
        .post-body hr {
          border: 0; border-top: 1px solid #E5E7EB; margin: 32px 0;
        }
      `}</style>
    </div>
  );
}
