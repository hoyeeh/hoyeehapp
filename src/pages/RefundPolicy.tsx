import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";

const RefundPolicy = () => {
  const navigate = useNavigate();

  useSEO({
    title: "Refund Policy | Hoyeeh",
    description: "Read Hoyeeh's refund policy for membership payments and pay-to-view purchases.",
    url: "https://hoyeeh.com/refund-policy",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-6 md:px-12">
        <Logo />
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="mb-8 font-display text-4xl md:text-5xl">Refund Policy</h1>

        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">Last updated: September 2026</p>
          <p className="text-lg">
            This Refund Policy applies to membership payments and pay-to-view purchases made directly through
            Hoyeeh. It should be read together with our Terms of Use.
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">1. Membership Payments</h2>
            <p>
              A request for a refund of a membership payment must be submitted within 24 hours of that payment.
              Cancelling a membership does not automatically create a refund request. Unless a refund is approved,
              cancellation takes effect at the end of the current paid billing period.
            </p>
            <p>
              We do not ordinarily provide refunds or credits for partially used billing periods, unused membership
              time, or a failure to cancel before a renewal date.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">2. Pay-to-View Purchases</h2>
            <p>
              A pay-to-view purchase may be considered for a refund only if the purchased title has not been viewed.
              Once playback has started, the purchase is not eligible for a refund, except where required by
              applicable law.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">3. Review and Approval</h2>
            <p>
              All refund requests are reviewed individually. Refunds are granted only at Hoyeeh's discretion,
              subject to any rights that cannot be excluded under applicable law. Submitting a request does not
              guarantee that a refund will be approved.
            </p>
            <p>
              We may consider account activity, viewing activity, transaction records, previous refund requests,
              suspected misuse, and the reason provided when reviewing a request.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. How to Request a Refund</h2>
            <p>
              Email <a href="mailto:support@hoyeeh.com" className="text-brand hover:underline">support@hoyeeh.com</a>
              {" "}from the address associated with your Hoyeeh account. Include your account email, transaction
              date, payment reference, purchase type, and reason for the request. Membership refund requests received
              after the 24-hour period are not eligible for consideration, except where required by applicable law.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">5. Third-Party Billing</h2>
            <p>
              If you paid through an app store, mobile network, or another third-party billing provider, your request
              may also be subject to that provider's refund terms and process.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-muted-foreground">
        <Logo className="mx-auto mb-4 opacity-50" />
        <p className="text-sm">© {new Date().getFullYear()} Hoyeeh Africa. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default RefundPolicy;