import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

const Copyright = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { state: { from: '/copyright' } });
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-10 w-10 text-brand" />
          <h1 className="font-display text-4xl md:text-5xl">Copyright Infringement Policy</h1>
        </div>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">Last updated: September 2026</p>
          
          <div className="bg-brand/10 border border-brand/20 rounded-lg p-6 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-brand flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-foreground font-semibold mb-2">Important Notice</h3>
                <p className="text-sm">
                  Hoyeeh.com respects intellectual property rights and expects all users to do the same. 
                  We respond promptly to all valid copyright infringement notices.
                </p>
              </div>
            </div>
          </div>
          
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Overview</h2>
            <p>
              Hoyeeh.com respects copyright law and expects its users to do the same. In accordance with the 
              Digital Millennium Copyright Act ("DMCA"), the text of which may be found on the U.S. Copyright 
              Office website at{" "}
              <a 
                href="http://www.copyright.gov/legislation/dmca.pdf" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                http://www.copyright.gov/legislation/dmca.pdf
              </a>
              , Hoyeeh.com will respond expeditiously to notices of alleged copyright infringement that are 
              reported to Hoyeeh.com's Designated Copyright Agent, identified in the sample Notice below.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Filing a DMCA Notice</h2>
            <p>
              To file a copyright infringement notification with Hoyeeh.com ("Notice"), you will need to send 
              a written communication that includes substantially the following (please consult your legal 
              counsel or see Section 512(c)(3) of the DMCA to confirm these requirements):
            </p>
            
            <div className="bg-secondary/50 rounded-lg p-6 space-y-4">
              <ol className="list-decimal pl-6 space-y-4">
                <li>
                  <strong className="text-foreground">Signature:</strong> A physical or electronic signature of 
                  a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.
                </li>
                <li>
                  <strong className="text-foreground">Identification of Work:</strong> Identification of the 
                  copyrighted work claimed to have been infringed, or, if multiple copyrighted works at a single 
                  online site are covered by a single notification, a representative list of such works at that site.
                </li>
                <li>
                  <strong className="text-foreground">Location of Material:</strong> Identification of the material 
                  that is claimed to be infringing or to be the subject of infringing activity and that is to be 
                  removed or access to which is to be disabled, and information reasonably sufficient to permit 
                  the service provider to locate the material. <em className="text-brand">Providing URLs in the 
                  body of an email is the best way to help us locate content quickly.</em>
                </li>
                <li>
                  <strong className="text-foreground">Contact Information:</strong> Information reasonably 
                  sufficient to permit the service provider to contact the complaining party, such as an address, 
                  telephone number, and, if available, an electronic mail address at which the complaining party 
                  may be contacted.
                </li>
                <li>
                  <strong className="text-foreground">Good Faith Statement:</strong> A statement that the 
                  complaining party has a good faith belief that use of the material in the manner complained 
                  of is not authorized by the copyright owner, its agent, or the law.
                </li>
                <li>
                  <strong className="text-foreground">Accuracy Statement:</strong> A statement that the information 
                  in the notification is accurate, and under penalty of perjury, that the complaining party is 
                  authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.
                </li>
              </ol>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">How to Submit a Notice</h2>
            <p>
              Deliver this Notice, with all items completed, to Hoyeeh.com through one of the following methods:
            </p>
            <div className="bg-secondary/50 rounded-lg p-6">
              <h3 className="text-foreground font-semibold mb-3">Designated Copyright Agent</h3>
              <p><strong>Hoyeeh Africa Limited</strong></p>
              <p>DMCA Copyright Agent</p>
              <p>Email: <a href="mailto:copyright@hoyeeh.com" className="text-brand hover:underline">copyright@hoyeeh.com</a></p>
              <p className="mt-4 text-sm">
                You may also submit notices through our{" "}
                <a href="/contact" className="text-brand hover:underline">Contact Page</a>.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Important Legal Notices</h2>
            
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
              <h3 className="text-foreground font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Warning About False Claims
              </h3>
              <p>
                Please note that under Section 512(f) of the DMCA, any person who knowingly materially 
                misrepresents that material or activity is infringing <strong>may be subject to liability 
                for damages</strong>. This includes court costs and attorneys' fees incurred by the alleged 
                infringer, by any copyright owner or authorized licensee, or by the service provider.
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-6">
              <h3 className="text-foreground font-semibold mb-3">Information Forwarding</h3>
              <p>
                Please also note that the information provided in this legal Notice may be forwarded to the 
                person who provided the allegedly infringing content. This allows them the opportunity to 
                respond with a counter-notification if they believe the content was removed in error.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Our Policy on Infringement</h2>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                Hoyeeh.com does not permit copyright infringing activities on its websites and will, if properly 
                notified that files infringe a copyright, remove or disable access to such files.
              </li>
              <li>
                Hoyeeh.com reserves the right to remove or disable access to files or links to allegedly 
                infringing material without prior notice.
              </li>
              <li>
                Repeat infringers may have their accounts terminated in accordance with our Terms of Use.
              </li>
              <li>
                We process all valid DMCA notices within 48-72 hours of receipt.
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Counter-Notification</h2>
            <p>
              If you believe that your content was removed or disabled by mistake or misidentification, you may 
              submit a counter-notification to our Designated Copyright Agent. Your counter-notification must include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your physical or electronic signature</li>
              <li>Identification of the material that was removed and its location before removal</li>
              <li>A statement under penalty of perjury that you have a good faith belief that the material was 
                  removed as a result of mistake or misidentification</li>
              <li>Your name, address, and telephone number</li>
              <li>A statement that you consent to the jurisdiction of the Federal District Court for your 
                  judicial district</li>
              <li>A statement that you will accept service of process from the person who provided the 
                  original complaint</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">Contact Information</h2>
            <p>
              For questions about this Copyright Policy or to report copyright infringement, please contact:
            </p>
            <div className="bg-secondary/50 rounded-lg p-4 mt-4">
              <p><strong>Hoyeeh Africa Limited</strong></p>
              <p><strong>DMCA/Copyright Department</strong></p>
              <p>Email: <a href="mailto:copyright@hoyeeh.com" className="text-brand hover:underline">copyright@hoyeeh.com</a></p>
              <p>General: <a href="mailto:info@hoyeeh.com" className="text-brand hover:underline">info@hoyeeh.com</a></p>
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

export default Copyright;