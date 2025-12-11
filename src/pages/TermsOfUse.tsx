import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsOfUse = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex justify-between items-center px-6 md:px-12 py-6 border-b border-border">
        <Logo />
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl md:text-5xl mb-8">Terms of Use</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">Last updated: December 2024</p>
          
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Hoyeeh ("the Service"), you accept and agree to be bound by the terms and 
              provisions of this agreement. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">2. Description of Service</h2>
            <p>
              Hoyeeh is a streaming service that provides access to African movies, TV shows, and documentaries. 
              The Service allows subscribers to access content on various internet-connected devices.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">3. Subscription and Billing</h2>
            <p>
              Access to Hoyeeh requires a paid subscription. By subscribing, you authorize us to charge your 
              payment method on a recurring basis. You can cancel your subscription at any time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. You agree 
              to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">5. Content Usage</h2>
            <p>
              All content on Hoyeeh is for personal, non-commercial use only. You may not copy, distribute, 
              modify, or create derivative works from our content without express written permission.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">6. Intellectual Property</h2>
            <p>
              All content, trademarks, and intellectual property on Hoyeeh are owned by Hoyeeh Africa or 
              its licensors. Unauthorized use is prohibited.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">7. Limitation of Liability</h2>
            <p>
              Hoyeeh is provided "as is" without warranties of any kind. We are not liable for any indirect, 
              incidental, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">8. Contact</h2>
            <p>
              For questions about these Terms, please contact us at{" "}
              <a href="mailto:info@hoyeeh.com" className="text-brand hover:underline">
                info@hoyeeh.com
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-muted-foreground">
        <Logo className="mx-auto mb-4 opacity-50" />
        <p className="text-sm">© {new Date().getFullYear()} Hoyeeh Africa. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default TermsOfUse;
