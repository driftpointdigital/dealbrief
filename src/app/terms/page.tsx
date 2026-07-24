import type { Metadata } from "next";
import LegalLayout, { H2 } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service | DealBrief",
  description: "The terms governing your use of DealBrief.",
  alternates: { canonical: "https://www.getdealbrief.com/terms" },
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="July 22, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of DealBrief
        (the &quot;Service&quot;), operated by Driftpoint Digital (&quot;we&quot;, &quot;us&quot;). By creating an
        account or using the Service, you agree to these Terms.
      </p>

      <H2>What DealBrief is</H2>
      <p>
        DealBrief is a pre-offer research tool for multifamily real estate. It aggregates
        public and third-party data (tax assessments, permit history, FEMA flood zones,
        crime data, demographics) and produces underwriting scenarios and reports. DealBrief
        is an informational tool only. It is not investment, tax, legal, or financial advice,
        and it is not a substitute for your own due diligence or professional advisers.
      </p>

      <H2>Accounts</H2>
      <p>
        You must provide accurate information and keep your login credentials secure. You are
        responsible for all activity under your account. You must be at least 18 and able to
        form a binding contract.
      </p>

      <H2>Plans, billing, and trial</H2>
      <p>
        Each account receives one free report. Beyond that, the Service is offered on a
        subscription of $29 per month, which includes 20 report runs per billing period.
        Additional runs beyond 20 are billed at $2 per run. New subscriptions include a trial
        of 14 days or 10 report runs, whichever comes first. Subscriptions renew automatically
        each month until canceled. You authorize us (via our payment processor, Stripe) to
        charge your payment method for the subscription and any overage. Prices may change on
        prospective notice.
      </p>

      <H2>Cancellation and refunds</H2>
      <p>
        You may cancel anytime from your account; access continues through the end of the
        current billing period. Refunds are governed by our{" "}
        <a href="/refunds" style={{ color: "#457B9D" }}>Refund Policy</a>.
      </p>

      <H2>Acceptable use</H2>
      <p>
        You agree not to scrape, resell, or redistribute the Service or its data in bulk;
        not to reverse engineer or interfere with the Service; not to exceed rate limits or
        circumvent access controls; and not to use the Service for any unlawful purpose.
      </p>

      <H2>Data accuracy and no warranty</H2>
      <p>
        Data comes from public records and third-party providers and may be incomplete,
        delayed, or inaccurate. Tax reassessment figures are estimates based on published
        rates and statutes and are not a guarantee of your actual future tax bill. The Service
        is provided &quot;as is&quot; without warranties of any kind, express or implied, including
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>

      <H2>Limitation of liability</H2>
      <p>
        To the maximum extent permitted by law, we will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or for any lost profits or
        investment losses arising from your use of the Service. Our total liability for any
        claim will not exceed the amount you paid us in the 12 months before the claim.
      </p>

      <H2>Changes and termination</H2>
      <p>
        We may modify the Service or these Terms; material changes will be posted here with an
        updated date. We may suspend or terminate accounts that violate these Terms. You may
        stop using the Service at any time.
      </p>

      <H2>Governing law</H2>
      <p>
        These Terms are governed by the laws of the United States and the state in which
        Driftpoint Digital is organized, without regard to conflict-of-laws rules.
      </p>
    </LegalLayout>
  );
}
