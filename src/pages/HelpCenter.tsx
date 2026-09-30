import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, Mail, MessageSquare, FileText, CreditCard, User, Tv, Download, Shield, Settings, Play, Smartphone, Globe, Clock, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const HelpCenter = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // SEO meta tags
  useSEO({
    title: 'Help Center - Support & FAQs',
    description: 'Find answers to common questions about Hoyeeh. Get help with your account, billing, streaming, downloads, parental controls, and troubleshooting.',
    url: 'https://hoyeeh.com/help',
    keywords: [
      'Hoyeeh help',
      'support center',
      'FAQ',
      'frequently asked questions',
      'troubleshooting',
      'streaming help',
      'account help',
      'billing support',
    ],
  });

  const categories = [
    {
      icon: User,
      title: "Account & Profile",
      description: "Manage your account settings and profiles",
      topics: [
        {
          title: "Creating an account",
          content: "To create a Hoyeeh account, visit our website or download the app, click 'Sign Up', enter your email address, create a password, and verify your email. You can also sign up using your phone number with PIN authentication."
        },
        {
          title: "Managing profiles",
          content: "You can create up to 5 profiles per account. Go to Profile Settings to add, edit, or delete profiles. Each profile has its own viewing history, recommendations, and watchlist. Kids profiles restrict content to age-appropriate ratings."
        },
        {
          title: "Password reset",
          content: "Click 'Forgot Password' on the login page, enter your email address, and we'll send you a reset link. For PIN authentication users, use your secret word to reset your PIN."
        },
        {
          title: "Account security",
          content: "We recommend using a strong, unique password and enabling account alerts. Hoyeeh uses encryption to protect your data. Never share your login credentials with others."
        },
        {
          title: "Deleting your account",
          content: "To delete your account, go to Profile Settings > Account > Delete Account. This action is permanent and will remove all your data, viewing history, and cancel your subscription."
        },
      ],
    },
    {
      icon: CreditCard,
      title: "Billing & Subscriptions",
      description: "Subscription plans, payments, and billing",
      topics: [
        {
          title: "Subscription plans",
          content: "Hoyeeh offers monthly subscription plans with full access to our content library, including HD and 4K streaming where available, multiple profiles, and offline downloads."
        },
        {
          title: "Payment methods",
          content: "We accept credit/debit cards (Visa, Mastercard) processed through Stripe, and Mobile Money payments through Flutterwave for users in Africa."
        },
        {
          title: "Cancellation",
          content: "You can cancel your subscription anytime from your Profile Settings > Subscription. Your access continues until the end of your billing period unless Hoyeeh approves a refund."
        },
        {
          title: "Refund policy",
          content: "Membership refund requests must be sent to support@hoyeeh.com within 24 hours of payment. Pay-to-view purchases may be considered only if the title has not been viewed. All refunds are at Hoyeeh's discretion, except where required by law. Read the Refund Policy for full terms."
        },
        {
          title: "Updating payment info",
          content: "Go to Profile Settings > Subscription > Payment Method to update your card details or switch payment methods."
        },
      ],
    },
    {
      icon: Tv,
      title: "Watching Hoyeeh",
      description: "Streaming, devices, and playback",
      topics: [
        {
          title: "Supported devices",
          content: "Hoyeeh works on smartphones (iOS & Android), tablets, computers (via web browser), smart TVs (via web browser or casting), and streaming devices."
        },
        {
          title: "Video quality",
          content: "Hoyeeh automatically adjusts video quality based on your internet speed. You can manually select quality (480p, 720p, 1080p) in the player settings. 4K content is available where supported."
        },
        {
          title: "Downloads",
          content: "Premium subscribers can download movies and episodes for offline viewing. Downloads are encrypted and can only be played in the Hoyeeh app. Downloads expire when your subscription ends."
        },
        {
          title: "Casting to TV",
          content: "Use our built-in casting feature to watch on your TV. Enter the 6-digit pairing code shown on your TV receiver to connect. You can control playback from your phone or computer."
        },
        {
          title: "Subtitle and audio",
          content: "Access subtitles and audio options through the player settings (gear icon). Available languages vary by content. Contact us if you'd like to see additional language support."
        },
      ],
    },
    {
      icon: Download,
      title: "Downloads & Offline",
      description: "Download content for offline viewing",
      topics: [
        {
          title: "How to download",
          content: "Tap the download icon on any movie or episode to save it for offline viewing. Choose your preferred quality (480p, 720p, 1080p) based on your device storage."
        },
        {
          title: "Download limits",
          content: "You can download content on multiple devices, but the number may be limited based on your subscription. Downloaded content expires when your subscription ends or after 30 days, whichever comes first."
        },
        {
          title: "Managing downloads",
          content: "Go to Downloads in the menu to view, play, or delete your downloaded content. You can see storage usage and manage space from this screen."
        },
        {
          title: "WiFi-only downloads",
          content: "Enable WiFi-only mode in download settings to prevent downloads over mobile data. This helps you avoid unexpected data charges."
        },
        {
          title: "Download troubleshooting",
          content: "If downloads fail, check your internet connection and available storage. Ensure you have an active subscription. Try restarting the app if issues persist."
        },
      ],
    },
    {
      icon: Shield,
      title: "Parental Controls",
      description: "Manage content restrictions for children",
      topics: [
        {
          title: "Setting up parental controls",
          content: "Go to Profile Settings > Parental Controls to enable restrictions. Set a 4-digit PIN and choose the maximum content rating (G, PG, PG-13, R) allowed."
        },
        {
          title: "Kids profiles",
          content: "Create a Kids profile to automatically restrict content to G and PG ratings. Kids profiles have a simplified interface and cannot access mature content."
        },
        {
          title: "PIN protection",
          content: "When parental controls are enabled, a PIN is required to watch content above the set rating limit. Never share your parental PIN with children."
        },
        {
          title: "Changing restrictions",
          content: "You can adjust content restrictions anytime in Profile Settings. Enter your parental PIN to make changes to the rating limits."
        },
      ],
    },
    {
      icon: FileText,
      title: "Troubleshooting",
      description: "Fix common issues and problems",
      topics: [
        {
          title: "Playback issues",
          content: "If video won't play, check your internet connection (minimum 3 Mbps recommended). Try refreshing the page, clearing browser cache, or restarting the app. Disable VPNs if active."
        },
        {
          title: "Loading problems",
          content: "Slow loading can be caused by poor internet connection. Try switching to a lower video quality in player settings. Close other apps using bandwidth."
        },
        {
          title: "Audio/Video sync",
          content: "If audio is out of sync, try pausing and resuming playback. Refresh the page or restart the app. Check if the issue persists on other content."
        },
        {
          title: "App crashes",
          content: "Ensure you're running the latest version of the app. Clear the app cache, restart your device, and try again. If issues persist, reinstall the app."
        },
        {
          title: "Login issues",
          content: "If you can't log in, verify your email/phone and password. Try the 'Forgot Password' option. Clear browser cookies if using web. Contact support if locked out."
        },
      ],
    },
  ];

  const faqs = [
    {
      q: "How do I cancel my subscription?",
      a: "Go to your Profile settings, select Subscription, and click 'Cancel Subscription'. Your access will continue until the end of your billing period. You won't be charged again unless you resubscribe.",
    },
    {
      q: "Can I download content for offline viewing?",
      a: "Yes! All subscribers can download movies and shows to watch offline within the Hoyeeh app. Downloads are device-specific and encrypted for security. They expire when your subscription ends.",
    },
    {
      q: "How many profiles can I create?",
      a: "You can create up to 5 profiles per account, including Kids profiles with restricted content. Each profile has its own viewing history, recommendations, and watchlist.",
    },
    {
      q: "What devices are supported?",
      a: "Hoyeeh works on smartphones (iOS and Android), tablets, computers (via web browser), smart TVs (through our TV receiver web app or casting), and various streaming devices.",
    },
    {
      q: "Why is the video quality poor?",
      a: "Video quality automatically adjusts based on your internet speed. For HD streaming, we recommend at least 5 Mbps. You can manually select quality in the player settings. Check your internet connection if quality is consistently low.",
    },
    {
      q: "How do I cast to my TV?",
      a: "Open the TV receiver on your smart TV's web browser at hoyeeh.com/tv. A 6-digit pairing code will display. Click the cast icon in the app, enter the code, and you're connected! Control playback from your phone or computer.",
    },
    {
      q: "Is my payment information secure?",
      a: "Yes, absolutely. We use industry-standard encryption and process payments through trusted providers (Stripe and Flutterwave). We never store your full card details on our servers.",
    },
    {
      q: "How do I change my password?",
      a: "Go to Profile Settings > Account > Change Password. Enter your current password and then your new password twice. For security, you'll be logged out of other devices.",
    },
    {
      q: "What content is available?",
      a: "Hoyeeh offers a curated library of African movies, TV shows, documentaries, and original content. Our library is constantly growing with new releases added regularly.",
    },
    {
      q: "Can I share my account?",
      a: "Hoyeeh accounts are designed for personal and household use. You can create up to 5 profiles for family members in your household. Commercial sharing or reselling access is prohibited.",
    },
  ];

  const quickLinks = [
    { icon: Play, title: "Get Started", description: "New to Hoyeeh? Start here", link: "/auth" },
    { icon: Settings, title: "Account Settings", description: "Manage your account", link: "/profile" },
    { icon: CreditCard, title: "Manage Subscription", description: "View and update your plan", link: "/subscription" },
    { icon: Download, title: "Downloads", description: "View offline content", link: "/downloads" },
  ];

  const filteredCategories = searchQuery
    ? categories.filter(cat => 
        cat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cat.topics.some(topic => 
          topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          topic.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : categories;

  const filteredFaqs = searchQuery
    ? faqs.filter(faq => 
        faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.a.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

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
          <h1 className="font-display text-4xl md:text-5xl mb-4">How can we help?</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Search our help center or browse topics below to find answers to your questions
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto mb-12">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search for help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-14 text-lg bg-secondary border-muted"
          />
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {quickLinks.map((link) => (
            <Link
              key={link.title}
              to={link.link}
              className="bg-secondary/50 hover:bg-secondary rounded-lg p-4 text-center transition-colors"
            >
              <link.icon className="h-8 w-8 mx-auto mb-2 text-brand" />
              <h3 className="font-semibold text-sm">{link.title}</h3>
              <p className="text-xs text-muted-foreground mt-1">{link.description}</p>
            </Link>
          ))}
        </div>

        {/* Categories */}
        <section className="mb-12">
          <h2 className="font-display text-2xl mb-6">Help Topics</h2>
          <div className="space-y-4">
            {filteredCategories.map((category) => (
              <div key={category.title} className="bg-secondary/50 rounded-lg overflow-hidden">
                <div className="p-6 pb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                      <category.icon className="h-5 w-5 text-brand" />
                    </div>
                    <div>
                      <h3 className="font-display text-xl">{category.title}</h3>
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    </div>
                  </div>
                </div>
                <Accordion type="single" collapsible className="px-6 pb-4">
                  {category.topics.map((topic, index) => (
                    <AccordionItem key={index} value={`${category.title}-${index}`} className="border-border/50">
                      <AccordionTrigger className="text-left hover:text-brand">
                        {topic.title}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {topic.content}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="mb-12">
          <h2 className="font-display text-2xl mb-6">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {filteredFaqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`faq-${index}`} 
                className="bg-secondary/50 rounded-lg px-6 border-none"
              >
                <AccordionTrigger className="text-left hover:text-brand font-semibold">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        {/* Contact */}
        <section className="text-center bg-secondary/50 rounded-lg p-8">
          <HelpCircle className="h-12 w-12 mx-auto mb-4 text-brand" />
          <h2 className="font-display text-2xl mb-4">Still need help?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Can't find what you're looking for? Our support team is available to help you with any questions or issues.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="brand" asChild>
              <a href="mailto:support@hoyeeh.com">
                <Mail className="mr-2 h-4 w-4" /> Email Support
              </a>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/contact">
                <MessageSquare className="mr-2 h-4 w-4" /> Contact Us
              </Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            Support hours: Monday - Friday, 9:00 AM - 6:00 PM (WAT)
          </p>
        </section>

        {/* Additional Resources */}
        <section className="mt-12 grid md:grid-cols-3 gap-6">
          <Link to="/terms" className="bg-secondary/30 hover:bg-secondary/50 rounded-lg p-6 transition-colors">
            <FileText className="h-8 w-8 mb-3 text-brand" />
            <h3 className="font-semibold mb-2">Terms of Use</h3>
            <p className="text-sm text-muted-foreground">Read our terms and conditions</p>
          </Link>
          <Link to="/privacy" className="bg-secondary/30 hover:bg-secondary/50 rounded-lg p-6 transition-colors">
            <Shield className="h-8 w-8 mb-3 text-brand" />
            <h3 className="font-semibold mb-2">Privacy Policy</h3>
            <p className="text-sm text-muted-foreground">Learn how we protect your data</p>
          </Link>
          <Link to="/copyright" className="bg-secondary/30 hover:bg-secondary/50 rounded-lg p-6 transition-colors">
            <Globe className="h-8 w-8 mb-3 text-brand" />
            <h3 className="font-semibold mb-2">Copyright Policy</h3>
            <p className="text-sm text-muted-foreground">DMCA and copyright information</p>
          </Link>
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