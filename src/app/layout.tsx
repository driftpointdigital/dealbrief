import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import Script from "next/script";
import "./globals.css";

// Reddit Ads pixel ID. Hardcoded because it's public client-side data
// (visible in the served HTML anyway) and avoids a stale env-var on
// Vercel that would silently break conversion tracking. Update here if
// the Reddit Ads account ever changes.
const REDDIT_PIXEL_ID = "a2_j5a9d7bhxv19";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://www.getdealbrief.com";

const titleDefault =
  "DealBrief | Pre-Offer Research Reports for Multifamily Investors";
const descriptionDefault =
  "Enter a property address. Get tax assessment, permit history, flood zone, crime, demographics, and debt service analysis in 60 seconds. Covers DFW, Houston, Phoenix, Charlotte, Atlanta, Tampa, Orlando, Jacksonville, Miami, Raleigh-Durham, Louisville, Philadelphia, and more.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: titleDefault,
    template: "%s | DealBrief",
  },
  description: descriptionDefault,
  keywords: [
    "pre-offer property research",
    "multifamily research report",
    "multifamily due diligence",
    "apartment building research",
    "property tax reassessment multifamily",
    "multifamily permit history",
    "FEMA flood zone rental property",
    "multifamily debt service calculator",
    "apartment building DSCR analysis",
    "real estate deal analysis",
    "cap rate calculator multifamily",
  ],
  authors: [{ name: "DealBrief" }],
  creator: "DealBrief",
  publisher: "DealBrief",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "DealBrief",
    title: titleDefault,
    description: descriptionDefault,
  },
  twitter: {
    card: "summary_large_image",
    title: titleDefault,
    description:
      "Enter a property address. Get tax, permits, flood zone, crime, demographics, and debt service in 60 seconds.",
    creator: "@getdealbrief",
  },
  alternates: {
    canonical: siteUrl,
  },
};

// JSON-LD structured data. Organization + WebSite schemas help Google
// build a knowledge panel and (if/when search volume justifies it) the
// sitelinks search box. Inlined in <head> via dangerouslySetInnerHTML
// because Next.js Metadata API doesn't support raw JSON-LD natively.
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DealBrief",
  url: siteUrl,
  logo: `${siteUrl}/opengraph-image`,
  sameAs: [
    "https://twitter.com/getdealbrief",
  ],
  description:
    "Pre-offer research reports for multifamily real estate investors. Combines tax assessment, permit history, flood zone, crime, demographics, and debt service analysis into a single PDF.",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "DealBrief",
  url: siteUrl,
  description: descriptionDefault,
  publisher: {
    "@type": "Organization",
    name: "DealBrief",
    url: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
      {/* Reddit Ads pixel — base PageVisit fires on every page load.
          Conversion events (SignUp on free-report success, Lead on
          Stripe redirect) are fired client-side from DealBrief.tsx so
          they align with the existing GA `report_run` instrumentation. */}
      <Script id="reddit-pixel" strategy="afterInteractive">
        {`!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js?pixel_id=${REDDIT_PIXEL_ID}",t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','${REDDIT_PIXEL_ID}');rdt('track','PageVisit');`}
      </Script>
    </html>
  );
}
