import { useState } from "react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, Play, Download, Users, Tv } from "lucide-react";
import heroImage from "@/assets/hero-landing.png";

interface MobileLandingPageProps {
  onSignIn: () => void;
  onGetStarted: (email?: string) => void;
}

export const MobileLandingPage = ({ onSignIn, onGetStarted }: MobileLandingPageProps) => {
  const [email, setEmail] = useState("");

  const features = [
    { icon: Tv, title: "Watch Anywhere", desc: "Stream on any device" },
    { icon: Download, title: "Download", desc: "Watch offline" },
    { icon: Users, title: "Profiles", desc: "For the whole family" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Hero Section */}
      <div className="relative min-h-[85vh] flex flex-col">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroImage}
            className="w-full h-full object-cover"
            alt="Hoyeeh Hero"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-background" />
        </div>

        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 flex justify-between items-center px-4 py-4"
        >
          <Logo className="scale-90" />
          <Button variant="brand" size="sm" onClick={onSignIn}>
            Sign In
          </Button>
        </motion.header>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="font-display text-4xl font-bold mb-3 leading-tight drop-shadow-2xl">
              Watch Unlimited<br />Movies & TV Shows
            </h1>
            <p className="text-lg text-foreground/90 mb-2">
              Watch anywhere. Cancel anytime.
            </p>
            <p className="text-base text-muted-foreground mb-6">
              Ready to watch? Enter your email to get started.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full max-w-sm space-y-3"
          >
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 bg-background/60 backdrop-blur-sm border-muted-foreground/30 text-base placeholder:text-muted-foreground focus:border-brand focus:ring-brand"
            />
            <Button
              variant="brand"
              size="lg"
              className="w-full h-14 text-lg font-bold glow-brand"
              onClick={() => onGetStarted(email)}
            >
              Get Started <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <section className="py-10 px-6 bg-background">
        <div className="grid grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="text-center"
            >
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-brand/10 flex items-center justify-center">
                <feature.icon className="h-5 w-5 text-brand" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
              <p className="text-xs text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 px-6 bg-secondary/50">
        <div className="text-center space-y-4">
          <h2 className="font-display text-2xl">Start Streaming Today</h2>
          <p className="text-muted-foreground">
            Join millions of viewers enjoying African entertainment.
          </p>
          <Button
            variant="brand"
            size="lg"
            className="h-14 px-10 text-lg font-bold"
            onClick={() => onGetStarted()}
          >
            <Play className="mr-2 h-5 w-5" /> Start Watching
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-background text-muted-foreground text-center text-sm">
        <Logo className="mx-auto opacity-50 mb-4" />
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <a href="/about" className="hover:underline">About</a>
          <a href="/help" className="hover:underline">Help</a>
          <a href="/terms" className="hover:underline">Terms</a>
          <a href="/privacy" className="hover:underline">Privacy</a>
          <a href="/refund-policy" className="hover:underline">Refunds</a>
          <a href="/investor-relations" className="hover:underline">Investors</a>
        </div>
        <p className="text-xs">© {new Date().getFullYear()} Hoyeeh Africa</p>
      </footer>
    </div>
  );
};
