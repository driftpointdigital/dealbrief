import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://www.getdealbrief.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DealBrief — Multifamily Property Research & Analysis",
    template: "%s | DealBrief",
  },
  description:
    "Instant pre-offer research reports for multifamily investors. Tax assessment, permit history, flood zone, crime grades, demographics, and debt service analysis — in one PDF.",
  keywords: [
    "multifamily investment analysis",
    "pre-offer property research",
    "multifamily due diligence",
    "real estate deal analysis",
    "property research report",
    "multifamily underwriting tool",
    "apartment building analysis",
    "permit history lookup",
    "real estate investment tool",
    "cap rate calculator",
    "debt service coverage ratio",
    "multifamily deal brief",
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
    title: "DealBrief — Multifamily Property Research & Analysis",
    description:
      "Instant pre-offer research reports for multifamily investors. Tax assessment, permit history, flood zone, crime grades, demographics, and debt service analysis — in one PDF.",
  },
  twitter: {
    card: "summary_large_image",
    title: "DealBrief — Multifamily Property Research & Analysis",
    description:
      "Instant pre-offer research reports for multifamily investors. Tax, permits, flood zone, crime, demographics, and debt service — in one PDF.",
    creator: "@getdealbrief",
  },
  alternates: {
    canonical: siteUrl,
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
      <body className="min-h-full flex flex-col">{children}</body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
