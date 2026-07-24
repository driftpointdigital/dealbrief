import type { Metadata } from "next";
import LegalLayout, { H2 } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Refund Policy | DealBrief",
  description: "DealBrief's refund and cancellation policy.",
  alternates: { canonical: "https://www.getdealbrief.com/refunds" },
};

export default function RefundsPage() {
  return (
    <LegalLayout title="Refund Policy" lastUpdated="July 22, 2026">
      <p>
        We want DealBrief to be worth it. This policy explains cancellations and refunds for
        the subscription operated by Driftpoint Digital.
      </p>

      <H2>Try before you pay</H2>
      <p>
        Every account gets one free report with no card required, and every new subscription
        includes a trial of 14 days or 10 report runs, whichever comes first. You will not be
        charged the monthly fee until the trial ends. Cancel during the trial and you pay
        nothing.
      </p>

      <H2>Cancellation</H2>
      <p>
        You can cancel anytime from your account (Manage subscription). Cancellation stops the
        next renewal; your plan stays active through the end of the current billing period, and
        you keep access until then.
      </p>

      <H2>Monthly subscription refunds</H2>
      <p>
        Monthly charges are generally non-refundable, and we do not prorate partial months.
        That said, we handle refund requests in good faith: if you were charged in error, were
        double-billed, or cancel and were charged for a new period you did not intend to use,
        email us within 14 days of the charge and we will make it right.
      </p>

      <H2>Overage charges</H2>
      <p>
        Report runs beyond your included 20 per month are billed at $2 each and reflect usage
        already delivered, so they are non-refundable except in the case of a billing error.
        Note that a report is not charged when the county assessor lookup returns no data.
      </p>

      <H2>How to request a refund</H2>
      <p>
        Email{" "}
        <a href="mailto:info@getdealbrief.com" style={{ color: "#457B9D" }}>info@getdealbrief.com</a>{" "}
        from your account email with the date and amount of the charge. Approved refunds are
        returned to your original payment method via Stripe, typically within 5 to 10 business
        days.
      </p>
    </LegalLayout>
  );
}
