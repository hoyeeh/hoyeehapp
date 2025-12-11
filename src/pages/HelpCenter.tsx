import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Mail, MessageSquare, FileText, CreditCard, User, Tv } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const HelpCenter = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    {
      icon: User,
      title: "Account & Profile",
      topics: [
        "Creating an account",
        "Managing profiles",
        "Password reset",
        "Account security",
      ],
    },
    {
      icon: CreditCard,
      title: "Billing & Subscriptions",
      topics: [
        "Subscription plans",
        "Payment methods",
        "Cancellation",
        "Refund policy",
      ],
    },
    {
      icon: Tv,
      title: "Watching Hoyeeh",
      topics: [
        "Supported devices",
        "Video quality",
        "Downloads",
        "Casting to TV",
      ],
    },
    {
      icon: FileText,
      title: "Troubleshooting",
      topics: [
        "Playback issues",
        "Loading problems",
        "Audio/Video sync",
        "App crashes",
      ],
    },
  ];

  const faqs = [
    {
      q: "How do I cancel my subscription?",
      a: "Go to your Profile settings, select Subscription, and click 'Cancel Subscription'. Your access will continue until the end of your billing period.",
    },
    {
      q: "Can I download content for offline viewing?",
      a: "Yes! Premium subscribers can download movies and shows to watch offline within the Hoyeeh app.",
    },
    {
      q: "How many profiles can I create?",
      a: "You can create up to 5 profiles per account, including Kids profiles with restricted content.",
    },
    {
      q: "What devices are supported?",
      a: "Hoyeeh works on smartphones, tablets, computers, smart TVs, and streaming devices.",
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

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="font-display text-4xl md:text-5xl mb-4 text-center">How can we help?</h1>
        <p className="text-muted-foreground text-center mb-8">
          Search our help center or browse topics below
        </p>

        {/* Search */}
        <div className="relative max-w-xl mx-auto mb-12">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 text-lg bg-secondary border-muted"
          />
        </div>

        {/* Categories */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {categories.map((category) => (
            <div key={category.title} className="bg-secondary/50 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                  <category.icon className="h-5 w-5 text-brand" />
                </div>
                <h3 className="font-display text-xl">{category.title}</h3>
              </div>
              <ul className="space-y-2">
                {category.topics.map((topic) => (
                  <li key={topic}>
                    <a href="#" className="text-muted-foreground hover:text-brand transition-colors">
                      {topic}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* FAQs */}
        <section className="mb-12">
          <h2 className="font-display text-2xl mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-secondary/50 rounded-lg p-6">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="text-center bg-secondary/50 rounded-lg p-8">
          <h2 className="font-display text-2xl mb-4">Still need help?</h2>
          <p className="text-muted-foreground mb-6">
            Our support team is here to assist you
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="brand" asChild>
              <a href="mailto:support@hoyeeh.com">
                <Mail className="mr-2 h-4 w-4" /> Email Support
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="mailto:info@hoyeeh.com">
                <MessageSquare className="mr-2 h-4 w-4" /> General Inquiries
              </a>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6 text-center text-muted-foreground">
        <Logo className="mx-auto mb-4 opacity-50" />
        <p className="text-sm">© {new Date().getFullYear()} Hoyeeh Africa. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HelpCenter;
