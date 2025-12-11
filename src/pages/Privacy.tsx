import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
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
        <h1 className="font-display text-4xl md:text-5xl mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">Last updated: December 2024</p>
          <p className="text-lg">
            Hoyeeh Africa Limited ("Hoyeeh," "we," "us," or "our") is committed to protecting your privacy. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when 
            you use our streaming service, website, and applications (collectively, the "Service").
          </p>
          
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">1. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-4">1.1 Information You Provide</h3>
            <p>We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, phone number, password, and profile details</li>
              <li><strong>Payment Information:</strong> Credit/debit card details, mobile money information, billing address (processed securely by our payment providers)</li>
              <li><strong>Profile Information:</strong> Profile names, avatars, viewing preferences, and parental control settings</li>
              <li><strong>Communications:</strong> Information you provide when contacting our support team or responding to surveys</li>
              <li><strong>User-Generated Content:</strong> Reviews, ratings, and watchlist selections</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-4">1.2 Information Collected Automatically</h3>
            <p>When you use our Service, we automatically collect:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers, browser type, and mobile network information</li>
              <li><strong>Usage Information:</strong> Viewing history, search queries, content interactions, features used, and time spent on the Service</li>
              <li><strong>Location Information:</strong> IP address and general geographic location</li>
              <li><strong>Technical Information:</strong> Internet connection quality, streaming performance data, and error logs</li>
              <li><strong>Cookies and Similar Technologies:</strong> Session data, preferences, and authentication tokens</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-4">1.3 Information from Third Parties</h3>
            <p>We may receive information about you from:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Payment processors regarding transaction status</li>
              <li>Social media platforms if you choose to link your accounts</li>
              <li>Analytics providers to understand Service usage</li>
              <li>Advertising partners for marketing purposes</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            
            <h3 className="text-xl font-semibold text-foreground mt-4">2.1 Provide and Improve the Service</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create and manage your account</li>
              <li>Process subscriptions and payments</li>
              <li>Deliver and stream content</li>
              <li>Enable offline downloads</li>
              <li>Personalize content recommendations</li>
              <li>Maintain and improve Service performance</li>
              <li>Develop new features and services</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-4">2.2 Communicate With You</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Send service-related notifications and updates</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Notify you of new content, features, and offers</li>
              <li>Send subscription and billing reminders</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-4">2.3 Security and Legal Compliance</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Detect, prevent, and address fraud and abuse</li>
              <li>Enforce our Terms of Use and policies</li>
              <li>Comply with legal obligations</li>
              <li>Protect the rights and safety of users and third parties</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">3. Information Sharing and Disclosure</h2>
            <p>
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            
            <h3 className="text-xl font-semibold text-foreground mt-4">3.1 Service Providers</h3>
            <p>
              We share information with third-party vendors who provide services on our behalf, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Payment processors (Stripe, Flutterwave)</li>
              <li>Cloud hosting and storage providers</li>
              <li>Content delivery networks</li>
              <li>Customer support tools</li>
              <li>Analytics and monitoring services</li>
              <li>Email and notification services</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-4">3.2 Legal Requirements</h3>
            <p>We may disclose your information if required to do so by law or in response to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Court orders, subpoenas, or legal processes</li>
              <li>Government or regulatory requests</li>
              <li>Enforcement of our Terms of Use</li>
              <li>Protection against legal liability</li>
              <li>Investigation of suspected illegal activities</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-4">3.3 Business Transfers</h3>
            <p>
              If Hoyeeh is involved in a merger, acquisition, or sale of assets, your information may be 
              transferred as part of that transaction. We will notify you of any change in ownership or 
              use of your personal information.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">3.4 With Your Consent</h3>
            <p>
              We may share your information with third parties when you have given us explicit consent to do so.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Secure authentication mechanisms including PIN codes and password hashing</li>
              <li>Regular security assessments and penetration testing</li>
              <li>Access controls and employee training</li>
              <li>Monitoring for suspicious activities</li>
              <li>Encrypted storage for downloaded content</li>
            </ul>
            <p>
              While we strive to protect your information, no method of transmission or storage is 100% secure. 
              We cannot guarantee absolute security of your data.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">5. Data Retention</h2>
            <p>
              We retain your personal information for as long as necessary to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide the Service and maintain your account</li>
              <li>Comply with legal obligations</li>
              <li>Resolve disputes and enforce agreements</li>
              <li>Support business operations and analytics</li>
            </ul>
            <p>
              When you delete your account, we will delete or anonymize your personal information within 90 days, 
              except where retention is required by law or for legitimate business purposes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">6. Your Rights and Choices</h2>
            <p>
              Depending on your location, you may have the following rights regarding your personal information:
            </p>
            
            <h3 className="text-xl font-semibold text-foreground mt-4">6.1 Access and Portability</h3>
            <p>
              You have the right to request a copy of your personal information in a structured, 
              commonly used, and machine-readable format.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">6.2 Correction</h3>
            <p>
              You can update or correct your account information through your profile settings or by 
              contacting our support team.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">6.3 Deletion</h3>
            <p>
              You can request deletion of your account and personal information. Note that some information 
              may be retained as required by law or for legitimate business purposes.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">6.4 Opt-Out</h3>
            <p>You can opt out of:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Marketing communications by clicking "unsubscribe" in emails or adjusting notification settings</li>
              <li>Push notifications through your device settings</li>
              <li>Personalized recommendations in your account settings</li>
            </ul>

            <h3 className="text-xl font-semibold text-foreground mt-4">6.5 Restriction and Objection</h3>
            <p>
              You may request restriction of processing or object to certain uses of your data where 
              applicable under local law.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">7. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar technologies to enhance your experience:
            </p>
            
            <h3 className="text-xl font-semibold text-foreground mt-4">7.1 Essential Cookies</h3>
            <p>
              Required for the Service to function properly, including authentication and security.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">7.2 Performance Cookies</h3>
            <p>
              Help us understand how users interact with the Service to improve performance.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">7.3 Functional Cookies</h3>
            <p>
              Remember your preferences and settings to provide a personalized experience.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">7.4 Managing Cookies</h3>
            <p>
              You can manage cookie preferences through your browser settings. Note that disabling 
              certain cookies may affect the functionality of the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">8. Children's Privacy</h2>
            <p>
              Hoyeeh is not directed to children under 13 years of age. We do not knowingly collect 
              personal information from children under 13. If we learn that we have collected personal 
              information from a child under 13, we will delete that information promptly.
            </p>
            <p>
              Our Kids profiles are designed for parents to create controlled viewing experiences for 
              their children. Parents are responsible for supervising their children's use of the Service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country 
              of residence. These countries may have different data protection laws. When we transfer 
              your information internationally, we implement appropriate safeguards, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Standard contractual clauses approved by relevant authorities</li>
              <li>Data processing agreements with our service providers</li>
              <li>Compliance with applicable data transfer regulations</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">10. Third-Party Links</h2>
            <p>
              The Service may contain links to third-party websites or services. We are not responsible 
              for the privacy practices of these third parties. We encourage you to read the privacy 
              policies of any third-party sites you visit.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">11. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material 
              changes by:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Posting the updated policy on our website</li>
              <li>Updating the "Last updated" date</li>
              <li>Sending you a notification via email or the Service</li>
            </ul>
            <p>
              Your continued use of the Service after changes become effective constitutes your acceptance 
              of the updated Privacy Policy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">12. Regional Privacy Rights</h2>
            
            <h3 className="text-xl font-semibold text-foreground mt-4">12.1 European Economic Area (GDPR)</h3>
            <p>
              If you are in the EEA, you have rights under the General Data Protection Regulation including 
              access, rectification, erasure, restriction, portability, and the right to lodge a complaint 
              with a supervisory authority.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">12.2 California Residents (CCPA)</h3>
            <p>
              California residents have additional rights including the right to know what personal information 
              is collected, the right to delete, and the right to opt-out of the sale of personal information. 
              We do not sell personal information.
            </p>

            <h3 className="text-xl font-semibold text-foreground mt-4">12.3 African Union Data Protection</h3>
            <p>
              We comply with applicable data protection laws across African jurisdictions where we operate, 
              including the African Union Convention on Cyber Security and Personal Data Protection.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">13. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data 
              practices, please contact us:
            </p>
            <div className="bg-secondary/50 rounded-lg p-4 mt-4">
              <p><strong>Hoyeeh Africa Limited</strong></p>
              <p><strong>Data Protection Officer</strong></p>
              <p>Email: <a href="mailto:privacy@hoyeeh.com" className="text-brand hover:underline">privacy@hoyeeh.com</a></p>
              <p>General: <a href="mailto:info@hoyeeh.com" className="text-brand hover:underline">info@hoyeeh.com</a></p>
              <p>Support: <a href="mailto:support@hoyeeh.com" className="text-brand hover:underline">support@hoyeeh.com</a></p>
            </div>
            <p className="mt-4">
              We will respond to your inquiry within 30 days or as required by applicable law.
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

export default Privacy;