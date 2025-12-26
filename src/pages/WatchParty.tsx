import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchPartyContextSafe } from "@/contexts/WatchPartyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Play, ArrowRight, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

export default function WatchParty() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const context = useWatchPartyContextSafe();
  
  const [joinCode, setJoinCode] = useState(searchParams.get("code") || "");
  const [isJoining, setIsJoining] = useState(false);
  
  const joinParty = context?.joinParty;
  const party = context?.party;

  // If user has a code from URL and is authenticated, try to auto-join
  useEffect(() => {
    const codeFromUrl = searchParams.get("code");
    if (codeFromUrl && user && joinParty && !party) {
      handleJoin(codeFromUrl);
    }
  }, [user, searchParams, joinParty, party]);

  // If already in a party, redirect to content
  useEffect(() => {
    if (party) {
      const baseUrl = `/content/${party.content_id}`;
      const url = party.episode_id ? `${baseUrl}?episode=${party.episode_id}` : baseUrl;
      navigate(url);
    }
  }, [party, navigate]);

  const handleJoin = async (code?: string) => {
    const codeToJoin = code || joinCode.trim();
    
    if (!codeToJoin) {
      toast.error("Please enter a party code");
      return;
    }

    if (!user) {
      // Store the code and redirect to login
      sessionStorage.setItem("pendingWatchPartyCode", codeToJoin);
      navigate(`/auth?redirect=/watch-party?code=${codeToJoin}`);
      return;
    }

    if (!joinParty) return;

    setIsJoining(true);
    try {
      const joinedParty = await joinParty(codeToJoin);
      if (joinedParty) {
        const baseUrl = `/content/${joinedParty.content_id}`;
        const url = joinedParty.episode_id ? `${baseUrl}?episode=${joinedParty.episode_id}` : baseUrl;
        navigate(url);
        toast.success("Joined watch party! Taking you to the content...");
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleSignIn = () => {
    const code = joinCode.trim();
    if (code) {
      sessionStorage.setItem("pendingWatchPartyCode", code);
      navigate(`/auth?redirect=/watch-party?code=${code}`);
    } else {
      navigate("/auth?redirect=/watch-party");
    }
  };

  return (
    <>
      <Helmet>
        <title>Join Watch Party - Hoyeeh</title>
        <meta name="description" content="Join a Watch Party on Hoyeeh and watch movies and TV shows together with friends in real-time. Enter your party code to start watching together!" />
        <meta property="og:title" content="Join Watch Party - Hoyeeh" />
        <meta property="og:description" content="Watch movies and TV shows together with friends in real-time. Join a Watch Party now!" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Join Watch Party - Hoyeeh" />
        <meta name="twitter:description" content="Watch together with friends in real-time on Hoyeeh" />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Logo className="h-12" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-md"
        >
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center space-y-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-20 h-20 mx-auto bg-brand/20 rounded-full flex items-center justify-center"
              >
                <Users className="w-10 h-10 text-brand" />
              </motion.div>
              <CardTitle className="text-2xl font-display">Join Watch Party</CardTitle>
              <CardDescription className="text-base">
                Enter your party code to watch together with friends in real-time
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Input
                  placeholder="Enter party code (e.g., ABC123)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="h-14 text-center font-mono text-2xl tracking-[0.3em] uppercase"
                  autoFocus
                />
                
                {user ? (
                  <Button 
                    onClick={() => handleJoin()} 
                    disabled={isJoining || !joinCode.trim()}
                    className="w-full h-12 text-lg gap-2"
                  >
                    {isJoining ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <Play className="h-5 w-5" />
                        Join Party
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleSignIn}
                    className="w-full h-12 text-lg gap-2"
                  >
                    <LogIn className="h-5 w-5" />
                    Sign In to Join
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">How it works</span>
                </div>
              </div>

              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold shrink-0">
                    1
                  </div>
                  <p>Enter the 6-character party code shared by your friend</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold shrink-0">
                    2
                  </div>
                  <p>Wait for the host to start playback</p>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="w-6 h-6 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs font-bold shrink-0">
                    3
                  </div>
                  <p>Enjoy watching together with synchronized playback!</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-sm text-muted-foreground text-center"
        >
          Don't have a code?{" "}
          <button 
            onClick={() => navigate("/dashboard")}
            className="text-brand hover:underline"
          >
            Browse content and start your own party
          </button>
        </motion.p>
      </div>
    </>
  );
}
