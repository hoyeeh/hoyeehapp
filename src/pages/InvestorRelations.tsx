import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Film, Globe, Handshake, Tv } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";

const InvestorRelations = () => {
  const navigate = useNavigate();

  useSEO({
    title: "Investor Relations & Partnerships | Hoyeeh",
    description: "Learn how Hoyeeh works with local television networks and rights holders to bring African films to streaming audiences.",
    url: "https://hoyeeh.com/investor-relations",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-6 md:px-12">
        <Logo />
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="max-w-3xl space-y-5">
          <p className="font-semibold text-brand">Investor Relations & Partnerships</p>
          <h1 className="font-display text-4xl md:text-5xl">Building stronger routes from local screens to global audiences</h1>
          <p className="text-xl leading-relaxed text-muted-foreground">
            Hoyeeh works with local television networks, broadcasters, producers, distributors, and rights holders
            to make African films and programmes available to streaming audiences at home and abroad.
          </p>
        </div>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="space-y-4 rounded-lg bg-secondary/50 p-6">
            <Tv className="h-7 w-7 text-brand" />
            <h2 className="font-display text-2xl">Local Network Partnerships</h2>
            <p className="text-muted-foreground">
              We welcome conversations with local television networks seeking an additional digital outlet for
              licensed films, series, documentaries, and selected archive programming.
            </p>
          </article>
          <article className="space-y-4 rounded-lg bg-secondary/50 p-6">
            <Film className="h-7 w-7 text-brand" />
            <h2 className="font-display text-2xl">Rights and Distribution</h2>
            <p className="text-muted-foreground">
              Each arrangement is built around verified rights, agreed territories, availability windows, commercial
              terms, and the viewing formats authorised by the content owner.
            </p>
          </article>
          <article className="space-y-4 rounded-lg bg-secondary/50 p-6">
            <Globe className="h-7 w-7 text-brand" />
            <h2 className="font-display text-2xl">Audience Reach</h2>
            <p className="text-muted-foreground">
              Our goal is to help partners extend the life and reach of their catalogues while giving viewers a
              reliable destination for distinctive stories from across Africa.
            </p>
          </article>
          <article className="space-y-4 rounded-lg bg-secondary/50 p-6">
            <Handshake className="h-7 w-7 text-brand" />
            <h2 className="font-display text-2xl">Responsible Collaboration</h2>
            <p className="text-muted-foreground">
              We favour clear licensing, accurate attribution, transparent reporting, and long-term relationships
              that respect the work of networks, filmmakers, and production teams.
            </p>
          </article>
        </section>

        <section className="mt-12 border-t border-border pt-10">
          <h2 className="font-display text-3xl">Discuss a partnership</h2>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Local networks and rights holders interested in making their films available on Hoyeeh can contact our
            team with a brief introduction, catalogue summary, rights information, and target territories.
          </p>
          <Button variant="brand" className="mt-6" asChild>
            <a href="mailto:info@hoyeeh.com?subject=Content%20Partnership%20Enquiry">Contact Hoyeeh</a>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8 text-center text-muted-foreground">
        <Logo className="mx-auto mb-4 opacity-50" />
        <p className="text-sm">© {new Date().getFullYear()} Hoyeeh Africa. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default InvestorRelations;