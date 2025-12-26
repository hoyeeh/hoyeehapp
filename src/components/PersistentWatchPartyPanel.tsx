import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWatchPartyContextSafe } from "@/contexts/WatchPartyContext";
import { WatchPartyChat } from "@/components/WatchPartyChat";
import { WatchPartyReactions } from "@/components/WatchPartyReactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Copy, LogOut, Check, Loader2, UserPlus, MessageCircle, Radio, Play, Sparkles, Crown, Lock, AlertTriangle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";

interface ContentInfo {
  contentId: string;
  episodeId?: string;
  contentTitle: string;
}

export const PersistentWatchPartyPanel = () => {
  const { user } = useAuth();
  const { canAccessPremium, isLoading: subscriptionLoading } = useSubscriptionAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const context = useWatchPartyContextSafe();
  
  const [joinCode, setJoinCode] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "chat">("members");
  const [currentContent, setCurrentContent] = useState<ContentInfo | null>(null);
  const [prevAllReady, setPrevAllReady] = useState(false);
  const [isLaunchingContent, setIsLaunchingContent] = useState(false);
  const [showStartConfirmation, setShowStartConfirmation] = useState(false);
  const prevHasStartedRef = useRef<boolean | null>(null);

  // Destructure context values (with defaults for when context is null)
  const party = context?.party ?? null;
  const members = context?.members ?? [];
  const messages = context?.messages ?? [];
  const reactions = context?.reactions ?? [];
  const isHost = context?.isHost ?? false;
  const isLoading = context?.isLoading ?? false;
  const createParty = context?.createParty;
  const joinParty = context?.joinParty;
  const leaveParty = context?.leaveParty;
  const setReady = context?.setReady;
  const sendReaction = context?.sendReaction;
  const startWatchingTogether = context?.startWatchingTogether;

  // Listen for toggle event from video players with content info
  useEffect(() => {
    const handleToggle = (event: Event) => {
      const customEvent = event as CustomEvent<ContentInfo>;
      if (customEvent.detail?.contentId) {
        setCurrentContent(customEvent.detail);
      }
      setIsOpen(prev => !prev);
    };
    
    window.addEventListener('toggleWatchParty', handleToggle);
    return () => window.removeEventListener('toggleWatchParty', handleToggle);
  }, []);

  // Check if all members are ready and notify host
  useEffect(() => {
    if (!party || !isHost || members.length < 2) return;
    
    const allReady = members.every(m => m.is_ready);
    if (allReady && !prevAllReady) {
      toast.success("Everyone is ready! Start playing when you're set.", {
        duration: 5000,
        icon: "🎉"
      });
    }
    setPrevAllReady(allReady);
  }, [party, isHost, members, prevAllReady]);

  // Notify non-hosts when party starts
  useEffect(() => {
    if (!party || isHost) return;
    
    const hasStarted = (party as any).has_started;
    
    // Detect transition from not started to started
    if (hasStarted && prevHasStartedRef.current === false) {
      toast.success("🎬 The host has started playback! Get ready to watch together!", {
        duration: 5000,
      });
    }
    
    prevHasStartedRef.current = hasStarted;
  }, [party, isHost]);

  // If context is not available, don't render
  if (!context) {
    return null;
  }

  // Build the content URL for navigation
  const getContentUrl = () => {
    if (!party) return null;
    const baseUrl = `/content/${party.content_id}`;
    return party.episode_id ? `${baseUrl}?episode=${party.episode_id}` : baseUrl;
  };

  // Check if user is on the content page
  const isOnContentPage = () => {
    if (!party) return false;
    const contentUrl = getContentUrl();
    return contentUrl && location.pathname.includes(`/content/${party.content_id}`);
  };

  const handleWatchNow = async () => {
    const url = getContentUrl();
    if (url) {
      setIsLaunchingContent(true);
      // Short delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 800));
      navigate(url);
      setIsOpen(false);
      setIsLaunchingContent(false);
    }
  };

  const handleCreate = async () => {
    if (!currentContent?.contentId || !createParty) {
      toast.error("No content selected for watch party");
      return;
    }
    const newParty = await createParty(currentContent.contentId, currentContent.episodeId);
    if (newParty) {
      toast.success("Watch party created!");
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      toast.error("Please enter a party code");
      return;
    }
    if (!joinParty) return;
    const joinedParty = await joinParty(joinCode.trim());
    if (joinedParty) {
      setJoinCode("");
      // Navigate guest to content page
      const baseUrl = `/content/${joinedParty.content_id}`;
      const url = joinedParty.episode_id ? `${baseUrl}?episode=${joinedParty.episode_id}` : baseUrl;
      navigate(url);
      toast.success("Joined watch party! Taking you to the content...");
    }
  };

  const getShareData = () => {
    if (!party?.party_code) return null;
    const baseUrl = window.location.origin;
    const shareLink = `${baseUrl}/watch-party?code=${party.party_code}`;
    return {
      code: party.party_code,
      link: shareLink,
      text: `🎬 Join my Watch Party on Hoyeeh!\n\nParty Code: ${party.party_code}\n\nJoin here: ${shareLink}`
    };
  };

  const copyCode = () => {
    const shareData = getShareData();
    if (shareData) {
      navigator.clipboard.writeText(shareData.text);
      toast.success("Party invite copied! Share it with friends.");
    }
  };

  const shareParty = async () => {
    const shareData = getShareData();
    if (!shareData) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Watch Party on Hoyeeh!",
          text: `Party Code: ${shareData.code}`,
          url: shareData.link
        });
      } catch (error: any) {
        // User cancelled or share failed - fallback to copy
        if (error.name !== "AbortError") {
          copyCode();
        }
      }
    } else {
      copyCode();
    }
  };

  const contentTitle = currentContent?.contentTitle || "this content";

  return (
    <>
      {/* Render reactions overlay when in party and on content page */}
      {party && isOnContentPage() && <WatchPartyReactions />}
      
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex flex-col p-0 z-[200]">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center gap-2">
            Watch Party
            {party && isHost && <Badge variant="secondary">Host</Badge>}
          </SheetTitle>
        </SheetHeader>

        {!party ? (
          // Not in a party - show create/join options or subscription gate
          <div className="p-4 space-y-6 flex-1">
            {!canAccessPremium && !subscriptionLoading ? (
              // Subscription gate
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-8">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Premium Feature</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Watch Party is available exclusively for subscribers. Upgrade to watch content together with friends in real-time.
                  </p>
                </div>
                <div className="space-y-3 w-full">
                  <Button 
                    onClick={() => {
                      navigate('/subscription');
                      setIsOpen(false);
                    }}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade to Premium
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Get access to Watch Party, exclusive content, and more
                  </p>
                </div>
              </div>
            ) : (
              // Create/Join UI for subscribers
              <>
                <div>
                  <h3 className="font-medium mb-2">Create a Party</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Start watching "{contentTitle}" with friends
                  </p>
                  <Button 
                    onClick={handleCreate} 
                    disabled={isLoading || !currentContent?.contentId}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Create Watch Party
                  </Button>
                  {!currentContent?.contentId && (
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Start playing content first to create a party
                    </p>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium mb-2">Join a Party</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Enter a party code to join friends
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code (e.g., ABC123)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="font-mono tracking-widest"
                    />
                    <Button onClick={handleJoin} disabled={isLoading}>
                      Join
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          // In a party - show party info with tabs
          <>
            {/* Party Code */}
            <div className="px-4 py-3">
              <div className="p-3 bg-secondary rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Party Code</p>
                    <p className="text-xl font-mono font-bold tracking-widest">
                      {party.party_code}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={copyCode} title="Copy invite">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={shareParty} title="Share party">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share the code or link with friends to invite them!
                </p>
              </div>
            </div>

            {/* Tabs for Members and Chat */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "members" | "chat")} className="flex-1 flex flex-col">
              <TabsList className="mx-4 grid grid-cols-2">
                <TabsTrigger value="members" className="gap-2">
                  <Users className="h-4 w-4" />
                  Members ({members.length})
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                  {messages.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {messages.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="members" className="flex-1 px-4 mt-4 space-y-4 overflow-y-auto">
                {/* Members List */}
                <div className="space-y-2">
                  {members.map((member) => {
                    const isHostMember = member.user_id === party.host_user_id;
                    const displayName = member.display_name || (isHostMember ? "Host" : "Guest");
                    const initials = displayName.slice(0, 2).toUpperCase();
                    return (
                      <div 
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url} alt={displayName} />
                            <AvatarFallback className="bg-brand/20 text-brand text-xs">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{displayName}</span>
                            {isHostMember && <span className="text-xs text-muted-foreground">Host</span>}
                          </div>
                        </div>
                        {member.is_ready ? (
                          <Badge variant="default" className="gap-1">
                            <Check className="h-3 w-3" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Waiting</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Start Watching Together Button (for hosts when all ready and not started) */}
                {isHost && members.length > 1 && members.every(m => m.is_ready) && startWatchingTogether && !(party as any).has_started && (
                  <Button 
                    onClick={() => setShowStartConfirmation(true)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Start Watching Together
                  </Button>
                )}
                
                {/* Show party already started indicator */}
                {isHost && (party as any).has_started && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-green-500">
                      <Radio className="h-4 w-4 animate-pulse" />
                      <span className="text-sm font-medium">Watch Party is Live</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Everyone is watching together. New members cannot join.
                    </p>
                  </div>
                )}
                
                {/* Ready Button (for non-hosts) */}
                {!isHost && user && setReady && (() => {
                  const currentMember = members.find(m => m.user_id === user.id);
                  const isReady = currentMember?.is_ready ?? false;
                  return (
                    <Button 
                      onClick={() => setReady(!isReady)}
                      className="w-full"
                      variant={isReady ? "secondary" : "default"}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {isReady ? "Ready ✓" : "I'm Ready"}
                    </Button>
                  );
                })()}

                {/* Start Watching CTA (for guests not on content page) */}
                {!isHost && !isOnContentPage() && (
                  <div className="p-4 bg-gradient-to-r from-brand/10 to-brand/5 rounded-lg border border-brand/20">
                    {isLaunchingContent ? (
                      <div className="flex flex-col items-center gap-2 py-2">
                        <Loader2 className="h-6 w-6 animate-spin text-brand" />
                        <p className="text-sm text-muted-foreground">Launching content...</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground mb-3 text-center">
                          Ready to join the watch party?
                        </p>
                        <Button 
                          onClick={handleWatchNow}
                          className="w-full bg-brand hover:bg-brand/90"
                          size="lg"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start Watching
                        </Button>
                      </>
                    )}
                  </div>
                )}
                
                {/* Playback Status */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {party.is_playing ? (
                      <Radio className="h-4 w-4 text-green-500 animate-pulse" />
                    ) : (
                      <span className="h-4 w-4 rounded-full bg-yellow-500" />
                    )}
                    <span>
                      {party.is_playing ? "Playing" : "Paused"} at{" "}
                      {Math.floor(Number(party.playback_time) / 60)}:
                      {String(Math.floor(Number(party.playback_time) % 60)).padStart(2, '0')}
                    </span>
                  </div>
                  {isHost && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Your playback controls the party
                    </p>
                  )}
                  {!isHost && isOnContentPage() && (
                    <p className="text-xs text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-green-500 border-green-500">
                        Synced
                      </Badge>{" "}
                      Video syncs with the host
                    </p>
                  )}
                  {!isHost && !isOnContentPage() && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Click "Watch Now" to start watching
                    </p>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="chat" className="flex-1 overflow-hidden">
                <WatchPartyChat />
              </TabsContent>
            </Tabs>
            
            {/* Leave Button */}
            <div className="p-4 border-t">
              <Button 
                variant="destructive" 
                onClick={() => {
                  leaveParty?.();
                  setIsOpen(false);
                }}
                className="w-full"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {isHost ? "End Party" : "Leave Party"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
    
    {/* Confirmation Dialog for Starting Watch Party */}
    <AlertDialog open={showStartConfirmation} onOpenChange={setShowStartConfirmation}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Start Watch Party?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Once you start the watch party, <strong>no one else can join</strong>. 
              Make sure all your friends have joined before starting!
            </p>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" />
                <span className="font-medium">{members.length} member{members.length !== 1 ? 's' : ''} ready</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={() => {
              startWatchingTogether?.();
              setShowStartConfirmation(false);
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Watching
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};
