import { useState, useEffect } from "react";
import { useWatchPartyContext } from "@/contexts/WatchPartyContext";
import { WatchPartyChat } from "@/components/WatchPartyChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Copy, LogOut, Check, Loader2, UserPlus, MessageCircle, Radio } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ContentInfo {
  contentId: string;
  episodeId?: string;
  contentTitle: string;
}

export const PersistentWatchPartyPanel = () => {
  const { user } = useAuth();
  const {
    party,
    members,
    messages,
    isHost,
    isLoading,
    createParty,
    joinParty,
    leaveParty,
    setReady
  } = useWatchPartyContext();
  const [joinCode, setJoinCode] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "chat">("members");
  const [currentContent, setCurrentContent] = useState<ContentInfo | null>(null);

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

  const handleCreate = async () => {
    if (!currentContent?.contentId) {
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
    const joinedParty = await joinParty(joinCode.trim());
    if (joinedParty) {
      setJoinCode("");
      toast.success("Joined watch party!");
    }
  };

  const copyCode = () => {
    if (party?.party_code) {
      navigator.clipboard.writeText(party.party_code);
      toast.success("Party code copied!");
    }
  };

  const contentTitle = currentContent?.contentTitle || "this content";

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex flex-col p-0 z-[200]">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center gap-2">
            Watch Party
            {party && isHost && <Badge variant="secondary">Host</Badge>}
          </SheetTitle>
        </SheetHeader>

        {!party ? (
          // Not in a party - show create/join options
          <div className="p-4 space-y-6 flex-1">
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
          </div>
        ) : (
          // In a party - show party info with tabs
          <>
            {/* Party Code */}
            <div className="px-4 py-3">
              <div className="p-3 bg-secondary rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Party Code</p>
                  <p className="text-xl font-mono font-bold tracking-widest">
                    {party.party_code}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={copyCode}>
                  <Copy className="h-4 w-4" />
                </Button>
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
                  {members.map((member) => (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center">
                          <Users className="h-4 w-4 text-brand" />
                        </div>
                        <span className="text-sm">
                          {member.user_id === party.host_user_id ? "Host" : "Guest"}
                        </span>
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
                  ))}
                </div>
                
                {/* Ready Button (for non-hosts) */}
                {!isHost && user && (() => {
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
                  {!isHost && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Video syncs with the host
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
                  leaveParty();
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
  );
};
