import DealBrief from "@/components/DealBrief";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DealBrief",
  url: "https://www.getdealbrief.com",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Pre-offer property research reports for multifamily real estate investors. Instantly pulls tax assessments, permit history, FEMA flood zone, crime grades, demographics, and generates a debt service analysis PDF.",
  offers: {
    "@type": "Offer",
    price: "49",
    priceCurrency: "USD",
    description: "Per-report pricing for multifamily property research",
  },
  featureList: [
    "Tax assessment & ownership history",
    "Permit history lookup",
    "FEMA flood zone classification",
    "Crime grade analysis",
    "Census demographics",
    "Walk Score, Bike Score, Transit Score",
    "Debt service coverage ratio scenarios",
    "Cap rate analysis",
    "PDF report generation",
  ],
  audience: {
    "@type": "Audience",
    audienceType: "Real estate investors, multifamily buyers, property syndicators",
  },
  areaServed: [
    "Dallas-Fort Worth, TX",
    "Houston, TX",
    "Phoenix, AZ",
    "Charlotte, NC",
    "Atlanta, GA",
    "Louisville, KY",
    "Lexington, KY",
    "Tampa, FL",
    "Orlando, FL",
    "Jacksonville, FL",
    "Miami, FL",
    "Fort Lauderdale, FL",
    "West Palm Beach, FL",
    "Raleigh, NC",
    "Durham, NC",
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DealBrief />
    </>
  );
}
