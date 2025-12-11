import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, MessageSquare, Phone, Clock, FileText, Shield, Tv, CreditCard, User, Download, HelpCircle, ExternalLink, CheckCircle } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Support = () => {
  const navigate = useNavigate();

  const supportCategories = [
    {
      icon: User,
      title: "Account Issues",
      description: "Login problems, password reset, profile management",
      articles: [
        "I can't log into my account",
        "How do I reset my password?",
        "How do I change my email address?",
        "My account was suspended",
        "How do I delete my account?",
      ],
    },
    {
      icon: CreditCard,
      title: "Billing & Payments",
      description: "Subscription, charges, refunds",
      articles: [
        "I was charged incorrectly",
        "How do I cancel my subscription?",
        "My payment was declined",
        "How do I update my payment method?",
        "Request a refund",
      ],
    },
    {
      icon: Tv,
      title: "Streaming Issues",
      description: "Playback, quality, buffering",
      articles: [
        "Video won't play",
        "Poor video quality",
        "Constant buffering",
        "Audio out of sync",
        "Subtitles not showing",
      ],
    },
    {
      icon: Download,
      title: "Downloads",
      description: "Offline viewing, download errors",
      articles: [
        "Download failed",
        "Downloaded content won't play",
        "How to delete downloads",
        "Download quality settings",
        "Downloads expired",
      ],
    },
  ];

  const troubleshootingSteps = [
    {
      title: "Video playback issues",
      steps: [
        "Check your internet connection (minimum 3 Mbps for SD, 5 Mbps for HD)",
        "Refresh the page or restart the app",
        "Clear browser cache and cookies",
        "Disable browser extensions or VPN",
        "Try a different browser or device",
        "Update your browser to the latest version",
      ],
    },
    {
      title: "Login problems",
      steps: [
        "Verify your email address is correct",
        "Try the 'Forgot Password' option",
        "Clear browser cookies for hoyeeh.com",
        "Try logging in from a different browser",
        "Check if your account is active",
        "Contact support if still unable to login",
      ],
    },
    {
      title: "Payment issues",
      steps: [
        "Verify your card details are correct",
        "Ensure sufficient funds in your account",
        "Check if your card is enabled for online transactions",
        "Try a different payment method",
        "Contact your bank if payments are being blocked",
        "Reach out to our billing support team",
      ],
    },
  ];

  const systemRequirements = [
    {
      category: "Web Browser",
      requirements: [
        "Google Chrome (latest 2 versions)",
        "Mozilla Firefox (latest 2 versions)",
        "Safari 12+ (macOS)",
        "Microsoft Edge (latest 2 versions)",
        "JavaScript and cookies enabled",
      ],
    },
    {
      category: "Internet Speed",
      requirements: [
        "3 Mbps - Standard Definition (SD)",
        "5 Mbps - High Definition (HD)",
        "15 Mbps - Ultra HD/4K",
        "Stable connection recommended",
      ],
    },
    {
      category: "Mobile Devices",
      requirements: [
        "iOS 13.0 or later",
        "Android 7.0 or later",
        "2GB RAM minimum",
        "500MB free storage for app",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex justify-between items-center px-6 md:px-12 py-6 border-b border-border">
        <Logo />
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl mb-4">Support Center</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get help with your Hoyeeh account, billing, streaming, and more. 
            We're here to ensure you have the best experience.
          </p>
        </div>

        {/* Quick Contact */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <a
            href="mailto:support@hoyeeh.com"
            className="bg-secondary/50 hover:bg-secondary rounded-lg p-6 text-center transition-colors"
          >
            <Mail className="h-10 w-10 mx-auto mb-3 text-brand" />
            <h3 className="font-semibold mb-1">Email Support</h3>
            <p className="text-sm text-muted-foreground">support@hoyeeh.com</p>
          </a>
          <Link
            to="/help"
            className="bg-secondary/50 hover:bg-secondary rounded-lg p-6 text-center transition-colors"
          >
            <HelpCircle className="h-10 w-10 mx-auto mb-3 text-brand" />
            <h3 className="font-semibold mb-1">Help Center</h3>
            <p className="text-sm text-muted-foreground">Browse FAQs & guides</p>
          </Link>
          <Link
            to="/contact"
            className="bg-secondary/50 hover:bg-secondary rounded-lg p-6 text-center transition-colors"
          >
            <MessageSquare className="h-10 w-10 mx-auto mb-3 text-brand" />
            <h3 className="font-semibold mb-1">Contact Form</h3>
            <p className="text-sm text-muted-foreground">Send us a message</p>
          </Link>
        </div>

        {/* Support Categories */}
        <section className="mb-12">
          <h2 className="font-display text-2xl mb-6">Support Topics</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {supportCategories.map((category) => (
              <div key={category.title} className="bg-secondary/50 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                    <category.icon className="h-5 w-5 text-brand" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{category.title}</h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {category.articles.map((article, index) => (
                    <li key={index}>
                      <a
                        href="#"
                        className="text-sm text-muted-foreground hover:text-brand flex items-center gap-2 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        {article}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Troubleshooting Guides */}
        <section className="mb-12">
          <h2 className="font-display text-2xl mb-6">Troubleshooting Guides</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {troubleshootingSteps.map((guide, index) => (
              <AccordionItem
                key={index}
                value={`guide-${index}`}
                className="bg-secondary/50 rounded-lg px-6 border-none"
              >
                <AccordionTrigger className="text-left hover:text-brand font-semibold">
                  {guide.title}
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="space-y-3 mt-2">
                    {guide.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand/10 text-brand text-sm flex items-center justify-center">
                          {stepIndex + 1}
                        </span>
                        <span className="text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* System Requirements */}
        <section className="mb-12">
          <h2 className="font-display text-2xl mb-6">System Requirements</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {systemRequirements.map((req) => (
              <div key={req.category} className="bg-secondary/50 rounded-lg p-6">
                <h3 className="font-semibold mb-4">{req.category}</h3>
                <ul className="space-y-2">
                  {req.requirements.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Service Status */}
        <section className="mb-12">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <h3 className="font-semibold text-green-500">All Systems Operational</h3>
            </div>
            <p className="text-muted-foreground text-sm mb-4">
              Hoyeeh streaming service is currently operating normally. If you're experiencing issues, 
              please check your internet connection or try the troubleshooting steps above.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Streaming</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Downloads</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Authentication</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span>Payments</span>
              </div>
            </div>
          </div>
        </section>

        {/* Support Hours */}
        <section className="mb-12">
          <div className="bg-secondary/50 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="h-6 w-6 text-brand" />
              <h3 className="font-semibold text-xl">Support Hours</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">Email Support</h4>
                <p className="text-muted-foreground text-sm">
                  Monday - Friday: 9:00 AM - 6:00 PM (WAT)<br />
                  Saturday: 10:00 AM - 4:00 PM (WAT)<br />
                  Sunday: Closed
                </p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Response Times</h4>
                <p className="text-muted-foreground text-sm">
                  Technical Issues: Within 24 hours<br />
                  Billing Questions: 24-48 hours<br />
                  General Inquiries: 48-72 hours
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Policies */}
        <section className="grid md:grid-cols-3 gap-6">
          <Link to="/terms" className="bg-secondary/30 hover:bg-secondary/50 rounded-lg p-6 transition-colors">
            <FileText className="h-8 w-8 mb-3 text-brand" />
            <h3 className="font-semibold mb-2">Terms of Use</h3>
            <p className="text-sm text-muted-foreground">Service terms and conditions</p>
          </Link>
          <Link to="/privacy" className="bg-secondary/30 hover:bg-secondary/50 rounded-lg p-6 transition-colors">
            <Shield className="h-8 w-8 mb-3 text-brand" />
            <h3 className="font-semibold mb-2">Privacy Policy</h3>
            <p className="text-sm text-muted-foreground">How we handle your data</p>
          </Link>
          <Link to="/copyright" className="bg-secondary/30 hover:bg-secondary/50 rounded-lg p-6 transition-colors">
            <FileText className="h-8 w-8 mb-3 text-brand" />
            <h3 className="font-semibold mb-2">Copyright Policy</h3>
            <p className="text-sm text-muted-foreground">DMCA and infringement</p>
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-muted-foreground mt-12">
        <Logo className="mx-auto mb-4 opacity-50" />
        <p className="text-sm">© {new Date().getFullYear()} Hoyeeh Africa. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Support;