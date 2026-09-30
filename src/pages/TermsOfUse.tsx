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
          <p className="text-lg">Last updated: September 2026</p>
          <p className="text-lg">
            Welcome to Hoyeeh. These Terms of Use ("Terms") govern your access to and use of the Hoyeeh 
            streaming service, website, and applications (collectively, the "Service"). Please read these 
            Terms carefully before using our Service.
          </p>
          
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Hoyeeh Service, you agree to be bound by these Terms and our Privacy Policy. 
              If you do not agree to these Terms, you may not access or use the Service. These Terms constitute a 
              legally binding agreement between you and Hoyeeh Africa Limited ("Hoyeeh," "we," "us," or "our").
            </p>
            <p>
              We reserve the right to modify these Terms at any time. We will notify you of any material changes 
              by posting the updated Terms on our website or through the Service. Your continued use of the Service 
              after such modifications constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">2. Description of Service</h2>
            <p>
              Hoyeeh is a subscription-based streaming service that provides access to a curated library of African 
              movies, TV shows, documentaries, and original content. The Service allows subscribers to stream content 
              on various internet-connected devices and download select content for offline viewing within the Hoyeeh 
              application.
            </p>
            <p>Features of the Service include:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Unlimited streaming of available content during your subscription period</li>
              <li>Multiple user profiles per account (up to 5 profiles)</li>
              <li>Kids profiles with age-appropriate content restrictions</li>
              <li>Offline downloads for premium subscribers</li>
              <li>Personalized recommendations based on viewing history</li>
              <li>High-definition and ultra-high-definition streaming where available</li>
              <li>Casting to compatible smart TVs and devices</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">3. Eligibility and Registration</h2>
            <p>
              To use the Service, you must be at least 18 years old or the age of majority in your jurisdiction, 
              whichever is higher. If you are under 18, you may only use the Service under the supervision of a 
              parent or legal guardian who agrees to be bound by these Terms.
            </p>
            <p>When registering for an account, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate, current, and complete registration information</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security and confidentiality of your login credentials</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. Subscriptions, Purchases, and Billing</h2>
            <p>
              Access to Hoyeeh requires a paid subscription. By subscribing, you authorize us to charge your 
              selected payment method on a recurring basis at the then-current subscription rate.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-4">4.1 Subscription Terms</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Subscriptions are billed monthly in advance</li>
              <li>Your subscription will automatically renew unless cancelled before the renewal date</li>
              <li>You may cancel your subscription at any time through your account settings</li>
              <li>Cancellation takes effect at the end of your current billing period</li>
              <li>Refund eligibility is governed by our Refund Policy</li>
            </ul>
            <h3 className="text-xl font-semibold text-foreground mt-4">4.2 Price Changes</h3>
            <p>
              We reserve the right to change subscription prices. We will provide you with reasonable notice of 
              any price changes, and you will have the opportunity to cancel before the new price takes effect.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-4">4.3 Payment Methods</h3>
            <p>
              We accept various payment methods including credit/debit cards and mobile money. You are responsible 
              for keeping your payment information current. If payment fails, we may suspend or terminate your access 
              to the Service.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-4">4.4 Refunds</h3>
            <p>
              Membership refund requests must be submitted within 24 hours of the membership payment. A pay-to-view
              purchase may be considered for a refund only if the purchased title has not been viewed. All refunds
              are granted at Hoyeeh's discretion, except where applicable law requires otherwise. Please read our{" "}
              <a href="/refund-policy" className="text-brand hover:underline">Refund Policy</a> for the complete terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">5. User Accounts and Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all 
              activities that occur under your account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create a strong, unique password for your account</li>
              <li>Not share your account credentials with third parties</li>
              <li>Not allow others to access your account without authorization</li>
              <li>Notify us immediately of any unauthorized access or security breach</li>
              <li>Not create multiple accounts to circumvent usage limits</li>
            </ul>
            <p>
              We reserve the right to terminate accounts that violate these Terms or are used fraudulently. 
              Hoyeeh is designed for personal, non-commercial use. Account sharing beyond your household may 
              result in account restrictions or termination.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">6. Content Usage and Restrictions</h2>
            <h3 className="text-xl font-semibold text-foreground mt-4">6.1 License Grant</h3>
            <p>
              Subject to your compliance with these Terms, Hoyeeh grants you a limited, non-exclusive, 
              non-transferable, revocable license to access and view content available on the Service solely 
              for your personal, non-commercial use.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-4">6.2 Prohibited Uses</h3>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Copy, reproduce, distribute, or publicly display any content</li>
              <li>Modify, adapt, translate, or create derivative works from content</li>
              <li>Circumvent, disable, or interfere with security features</li>
              <li>Use any automated systems to access the Service</li>
              <li>Reverse engineer, decompile, or disassemble any aspect of the Service</li>
              <li>Remove, alter, or obscure any copyright or proprietary notices</li>
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Share, transfer, or resell your subscription or account access</li>
              <li>Record, capture, or redistribute streaming content</li>
              <li>Use VPNs or other technologies to circumvent geographic restrictions</li>
            </ul>
            <h3 className="text-xl font-semibold text-foreground mt-4">6.3 Downloads</h3>
            <p>
              Downloaded content is encrypted and can only be viewed within the Hoyeeh application on the 
              device where it was downloaded. Downloads are subject to license restrictions and will expire 
              when your subscription ends or as otherwise specified.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">7. Intellectual Property Rights</h2>
            <p>
              All content available through the Service, including but not limited to movies, TV shows, graphics, 
              logos, icons, images, audio clips, video clips, and software, is the property of Hoyeeh or its 
              licensors and is protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p>
              The Hoyeeh name, logo, and all related names, logos, product and service names, designs, and slogans 
              are trademarks of Hoyeeh Africa Limited. You may not use these marks without our prior written permission.
            </p>
            <p>
              Nothing in these Terms grants you any right, title, or interest in any intellectual property owned 
              or licensed by Hoyeeh, except for the limited license granted in Section 6.1.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">8. Content Availability and Quality</h2>
            <p>
              Content availability on Hoyeeh may vary by geographic region and is subject to change. We reserve 
              the right to add, remove, or modify content at any time without notice. Streaming quality depends 
              on various factors including your internet connection speed and device capabilities.
            </p>
            <p>
              We do not guarantee that any specific content will be available at any particular time or that 
              the Service will be uninterrupted, error-free, or free of harmful components.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">9. User Conduct</h2>
            <p>When using the Service, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with all applicable laws and regulations</li>
              <li>Respect the rights of others, including privacy and intellectual property rights</li>
              <li>Not submit false or misleading information</li>
              <li>Not engage in any activity that could harm, disable, or impair the Service</li>
              <li>Not interfere with other users' enjoyment of the Service</li>
              <li>Not upload viruses, malware, or other malicious code</li>
              <li>Not attempt to gain unauthorized access to any part of the Service</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">10. Third-Party Services</h2>
            <p>
              The Service may contain links to third-party websites or services that are not owned or controlled 
              by Hoyeeh. We have no control over and assume no responsibility for the content, privacy policies, 
              or practices of any third-party sites or services.
            </p>
            <p>
              Your interactions with third-party payment processors are governed by their respective terms and 
              privacy policies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">11. Disclaimer of Warranties</h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS 
              OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A 
              PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
            </p>
            <p>
              HOYEEH DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, THAT DEFECTS 
              WILL BE CORRECTED, OR THAT THE SERVICE IS FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">12. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, HOYEEH AND ITS AFFILIATES, OFFICERS, DIRECTORS, 
              EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR 
              PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER 
              INTANGIBLE LOSSES.
            </p>
            <p>
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU EXCEED THE AMOUNTS YOU HAVE PAID TO HOYEEH IN THE 
              TWELVE (12) MONTHS PRIOR TO THE CLAIM.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">13. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Hoyeeh and its affiliates, officers, directors, 
              employees, and agents from and against any claims, liabilities, damages, losses, costs, or expenses 
              (including reasonable attorneys' fees) arising out of or relating to your use of the Service, your 
              violation of these Terms, or your violation of any rights of another.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">14. Termination</h2>
            <p>
              We may terminate or suspend your account and access to the Service immediately, without prior notice 
              or liability, for any reason, including if you breach these Terms.
            </p>
            <p>
              Upon termination, your right to use the Service will immediately cease. All downloaded content will 
              become inaccessible. Provisions of these Terms that by their nature should survive termination shall 
              survive, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">15. Governing Law and Dispute Resolution</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of Cameroon, without 
              regard to its conflict of law provisions.
            </p>
            <p>
              Any dispute arising out of or relating to these Terms or the Service shall first be attempted to be 
              resolved through good-faith negotiation. If negotiation fails, disputes shall be submitted to binding 
              arbitration in accordance with the arbitration rules of the International Chamber of Commerce.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">16. General Provisions</h2>
            <h3 className="text-xl font-semibold text-foreground mt-4">16.1 Entire Agreement</h3>
            <p>
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and 
              Hoyeeh regarding the Service.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-4">16.2 Severability</h3>
            <p>
              If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions 
              shall continue in full force and effect.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-4">16.3 Waiver</h3>
            <p>
              Our failure to enforce any right or provision of these Terms shall not constitute a waiver of 
              such right or provision.
            </p>
            <h3 className="text-xl font-semibold text-foreground mt-4">16.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms without our prior written consent. We may assign our 
              rights and obligations under these Terms without restriction.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">17. Contact Information</h2>
            <p>
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="bg-secondary/50 rounded-lg p-4 mt-4">
              <p><strong>Hoyeeh Africa Limited</strong></p>
              <p>Email: <a href="mailto:info@hoyeeh.com" className="text-brand hover:underline">info@hoyeeh.com</a></p>
              <p>Support: <a href="mailto:support@hoyeeh.com" className="text-brand hover:underline">support@hoyeeh.com</a></p>
              <p>Website: <a href="https://hoyeeh.com" className="text-brand hover:underline">www.hoyeeh.com</a></p>
            </div>
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