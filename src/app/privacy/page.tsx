import type { Metadata } from "next";
import LegalLayout, { H2 } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | DealBrief",
  description: "How DealBrief collects, uses, and protects your information.",
  alternates: { canonical: "https://www.getdealbrief.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 22, 2026">
      <p>
        This Privacy Policy explains how DealBrief, operated by Driftpoint Digital, collects,
        uses, and protects information when you use the Service.
      </p>

      <H2>Information we collect</H2>
      <p>
        <strong>Account information:</strong> your email address and an authentication
        password (stored hashed by our auth provider). <strong>Billing information:</strong>{" "}
        handled by Stripe; we store a Stripe customer identifier and subscription status, not
        your full card number. <strong>Usage:</strong> the property addresses you research and
        a record of your report runs, so we can meter your plan and let you revisit reports.{" "}
        <strong>Analytics:</strong> standard web analytics (pages viewed, coarse funnel events)
        and, where applicable, advertising conversion pixels.
      </p>

      <H2>How we use it</H2>
      <p>
        To provide and meter the Service, process payments, maintain security, respond to
        support requests, understand and improve product usage, and comply with legal
        obligations. We do not sell your personal information.
      </p>

      <H2>Service providers</H2>
      <p>
        We share data with the vendors that run the Service on our behalf, including Supabase
        (authentication and database), Stripe (payments), Vercel (hosting), and the data
        providers that supply property records. These providers process data under their own
        terms and only as needed to provide their service.
      </p>

      <H2>Cookies</H2>
      <p>
        We use cookies that are necessary to keep you signed in, plus limited analytics
        cookies. You can control cookies through your browser settings.
      </p>

      <H2>Data retention</H2>
      <p>
        We retain account and usage data for as long as your account is active and as needed
        for legal, tax, and accounting purposes. You may request deletion of your account and
        associated personal data by emailing us.
      </p>

      <H2>Your choices</H2>
      <p>
        You may access, correct, or delete your account information, and you may unsubscribe
        from non-essential email. Depending on where you live, you may have additional rights
        under laws such as the GDPR or CCPA; contact us to exercise them.
      </p>

      <H2>Security</H2>
      <p>
        We use reputable providers and reasonable technical measures to protect your data. No
        method of transmission or storage is completely secure, so we cannot guarantee absolute
        security.
      </p>

      <H2>Children</H2>
      <p>The Service is not directed to anyone under 18, and we do not knowingly collect their data.</p>

      <H2>Changes</H2>
      <p>
        We may update this policy; material changes will be posted here with a new date.
        Questions or requests: email us at the address below.
      </p>
    </LegalLayout>
  );
}
