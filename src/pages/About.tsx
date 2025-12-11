import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Users, Globe, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

const About = () => {
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
        <h1 className="font-display text-4xl md:text-5xl mb-8">About Hoyeeh</h1>
        
        <div className="space-y-12">
          <section className="space-y-4">
            <p className="text-xl text-muted-foreground leading-relaxed">
              Hoyeeh is Africa's premier streaming platform, dedicated to bringing the best of African 
              entertainment to audiences worldwide. We believe in the power of African storytelling and 
              are committed to showcasing the rich diversity of African culture through film and television.
            </p>
          </section>

          <section className="grid md:grid-cols-2 gap-8">
            <div className="bg-secondary/50 rounded-lg p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Play className="h-6 w-6 text-brand" />
              </div>
              <h3 className="font-display text-xl">Our Mission</h3>
              <p className="text-muted-foreground">
                To be the leading destination for African content, making it accessible to everyone, 
                everywhere. We aim to celebrate and amplify African voices through world-class entertainment.
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-brand" />
              </div>
              <h3 className="font-display text-xl">Our Vision</h3>
              <p className="text-muted-foreground">
                To connect Africa to the world and the world to Africa through the universal language 
                of storytelling, creating a global community united by a love for African content.
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-brand" />
              </div>
              <h3 className="font-display text-xl">Our Community</h3>
              <p className="text-muted-foreground">
                We're more than a streaming service – we're a community of storytellers, filmmakers, 
                and viewers who share a passion for authentic African narratives.
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Heart className="h-6 w-6 text-brand" />
              </div>
              <h3 className="font-display text-xl">Our Values</h3>
              <p className="text-muted-foreground">
                Authenticity, diversity, quality, and accessibility drive everything we do. We're 
                committed to representing the full spectrum of African experiences and stories.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl">Contact Us</h2>
            <p className="text-muted-foreground">
              Have questions or want to learn more? Reach out to us at{" "}
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

export default About;
