import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Tv, Download, Users, ChevronRight, Plus } from "lucide-react";
import heroImage from "@/assets/hero-landing.png";
import { supabase } from "@/integrations/supabase/client";
import { Top10Row } from "./Top10Row";
import type { Content } from "@/types";

interface LandingPageProps {
  onSignIn: () => void;
  onGetStarted: (email?: string) => void;
}

export const LandingPage = ({ onSignIn, onGetStarted }: LandingPageProps) => {
  const [email, setEmail] = useState("");

  const faqs = [
    { q: "What is Hoyeeh?", a: "Hoyeeh is a streaming service featuring African movies, TV shows, and documentaries." },
    { q: "How much does it cost?", a: "Plans start from $4.99/month. Choose from different plans to fit your needs." },
    { q: "Where can I watch?", a: "Watch anywhere, anytime. Phone, tablet, laptop, or TV." },
    { q: "How do I cancel?", a: "Cancel anytime with just two clicks. No commitment required." },
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Public Top 10 — visible to logged-out visitors on the landing page.
  const { data: top10 = [] } = useQuery({
    queryKey: ["landing-top-10"],
    queryFn: async () => {
      // Fetch ranks and content separately — anon can't read `content` directly
      // after the recent RLS tightening, so we use the public view instead.
      const { data: ranks, error: ranksErr } = await supabase
        .from("top_10")
        .select("id, rank, content_id")
        .order("rank");
      if (ranksErr) throw ranksErr;
      const ids = (ranks || []).map((r: any) => r.content_id).filter(Boolean);
      if (ids.length === 0) return [];

      const { data: rows, error: contentErr } = await supabase
        .from("content_public" as any)
        .select("id, title, description, thumbnail_url, genre, content_type, is_premium, duration, year")
        .in("id", ids);
      if (contentErr) throw contentErr;
      const byId = new Map<string, any>((rows || []).map((r: any) => [r.id, r]));

      return (ranks || [])
        .map((r: any) => {
          const c = byId.get(r.content_id);
          if (!c) return null;
          return {
            rank: r.rank,
            content: {
              id: c.id,
              title: c.title,
              description: c.description || "",
              thumbnailUrl: c.thumbnail_url || "",
              videoUrl: "",
              genre: c.genre || "",
              contentType: c.content_type as "movie" | "series",
              isPremium: c.is_premium || false,
              duration: c.duration || 0,
              year: c.year,
            } as Content,
          };
        })
        .filter(Boolean) as Array<{ rank: number; content: Content }>;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-brand selection:text-primary-foreground">
      {/* Hero Section */}
      <div className="relative min-h-screen flex flex-col">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            className="w-full h-full object-cover"
            alt="Hoyeeh Hero"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
        </div>

        {/* Header */}
        <header className="relative z-20 flex justify-between items-center px-6 md:px-12 py-6">
          <Logo className="scale-100 md:scale-125 origin-left" />
          <Button variant="brand" size="sm" onClick={onSignIn}>
            Sign In
          </Button>
        </header>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center md:items-start justify-center text-center md:text-left px-6 md:px-20 animate-fade-in">
          <h1 className="font-display text-5xl md:text-8xl font-bold max-w-4xl mb-4 leading-none drop-shadow-2xl">
            Watch Unlimited<br />Movies & TV Shows
          </h1>
          <p className="text-xl md:text-3xl font-medium mb-4 text-foreground/90">
            Watch anywhere. Cancel anytime.
          </p>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl">
            Ready to watch? Enter your email to create or restart your membership.
          </p>

          <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl items-center">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 bg-background/60 backdrop-blur-sm border-muted-foreground/30 text-lg placeholder:text-muted-foreground focus:border-brand focus:ring-brand"
            />
            <Button
              variant="brand"
              size="lg"
              className="h-14 px-8 text-lg font-bold w-full md:w-auto glow-brand"
              onClick={() => onGetStarted(email)}
            >
              Get Started <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="border-t-8 border-secondary py-20 px-6 md:px-20 bg-background">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
          <div className="text-center animate-slide-up" style={{ animationDelay: "0.1s" }}>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-brand/10 flex items-center justify-center">
              <Tv className="h-8 w-8 text-brand" />
            </div>
            <h3 className="font-display text-2xl mb-3">Watch on any device</h3>
            <p className="text-muted-foreground">
              Stream on Smart TVs, PlayStation, Xbox, Chromecast, Apple TV, Blu-ray players, and more.
            </p>
          </div>
          
          <div className="text-center animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-brand/10 flex items-center justify-center">
              <Download className="h-8 w-8 text-brand" />
            </div>
            <h3 className="font-display text-2xl mb-3">Download offline</h3>
            <p className="text-muted-foreground">
              Save your favorites easily and always have something to watch.
            </p>
          </div>
          
          <div className="text-center animate-slide-up" style={{ animationDelay: "0.3s" }}>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-brand/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-brand" />
            </div>
            <h3 className="font-display text-2xl mb-3">Create profiles</h3>
            <p className="text-muted-foreground">
              Create up to 5 profiles for different members of your household.
            </p>
          </div>
        </div>
      </section>

      {/* Top 10 Section — public preview, clicking prompts sign in */}
      {top10.length > 0 && (
        <section className="border-t-8 border-secondary py-20 bg-background w-full">
          <Top10Row
            content={top10}
            onPlay={() => onSignIn()}
            onDetails={() => onSignIn()}
          />
        </section>
      )}

      {/* FAQ Section */}
      <section className="border-t-8 border-secondary py-20 px-6 md:px-20 bg-background">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-secondary hover:bg-muted transition-colors cursor-pointer overflow-hidden"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <div className="p-6 flex justify-between items-center text-xl md:text-2xl font-medium">
                  {faq.q}
                  <Plus className={`h-6 w-6 transition-transform ${openFaq === index ? "rotate-45" : ""}`} />
                </div>
                {openFaq === index && (
                  <div className="px-6 pb-6 text-lg text-muted-foreground animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-lg text-muted-foreground mb-6">
              Ready to watch? Enter your email to create or restart your membership.
            </p>
            <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 bg-secondary border-muted text-lg placeholder:text-muted-foreground"
              />
              <Button
                variant="brand"
                size="lg"
                className="h-14 px-8 text-lg font-bold w-full md:w-auto"
                onClick={() => onGetStarted(email)}
              >
                Get Started <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-8 border-secondary py-12 px-6 md:px-20 bg-background text-muted-foreground">
        <div className="max-w-5xl mx-auto">
          <p className="mb-6">
            Questions? Email us at{" "}
            <a href="mailto:info@hoyeeh.com" className="text-brand hover:underline">
              info@hoyeeh.com
            </a>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-sm">
            <a href="#faq" className="hover:underline">FAQ</a>
            <a href="/help" className="hover:underline">Help Center</a>
            <a href="/profile" className="hover:underline">Account</a>
            <a href="/about" className="hover:underline">About Us</a>
            <a href="/investor-relations" className="hover:underline">Investor Relations</a>
            <a href="/help" className="hover:underline">Ways to Watch</a>
            <a href="/terms" className="hover:underline">Terms of Use</a>
            <a href="/privacy" className="hover:underline">Privacy</a>
            <a href="/refund-policy" className="hover:underline">Refund Policy</a>
            <a href="/privacy" className="hover:underline">Cookie Preferences</a>
            <a href="/about" className="hover:underline">Corporate Information</a>
            <a href="mailto:info@hoyeeh.com" className="hover:underline">Contact Us</a>
            <a href="mailto:support@hoyeeh.com" className="hover:underline">Support</a>
          </div>
          <Logo className="opacity-50" />
          <p className="mt-4 text-sm">© {new Date().getFullYear()} Hoyeeh Africa. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
