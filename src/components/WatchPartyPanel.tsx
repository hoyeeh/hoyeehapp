import { useState } from "react";
import { useWatchParty } from "@/hooks/useWatchParty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Users, Copy, LogOut, Check, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface WatchPartyPanelProps {
  contentId: string;
  episodeId?: string;
  contentTitle: string;
  onSyncPlayback?: (time: number, playing: boolean) => void;
}

export const WatchPartyPanel = ({ 
  contentId, 
  episodeId, 
  contentTitle,
  onSyncPlayback 
}: WatchPartyPanelProps) => {
  const {
    party,
    members,
    isHost,
    isLoading,
    createParty,
    joinParty,
    leaveParty,
    setReady
  } = useWatchParty();
  
  const [joinCode, setJoinCode] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const handleCreate = async () => {
    const newParty = await createParty(contentId, episodeId);
    if (newParty) {
      setIsOpen(true);
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
    }
  };

  const copyCode = () => {
    if (party?.party_code) {
      navigator.clipboard.writeText(party.party_code);
      toast.success("Party code copied!");
    }
  };

  // Not in a party - show create/join options
  if (!party) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Users className="h-4 w-4" />
            Watch Party
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Watch Party</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            <div>
              <h3 className="font-medium mb-2">Create a Party</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Start watching "{contentTitle}" with friends
              </p>
              <Button 
                onClick={handleCreate} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Create Watch Party
              </Button>
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
        </SheetContent>
      </Sheet>
    );
  }

  // In a party - show party info
  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-brand text-brand">
          <Users className="h-4 w-4" />
          Party ({members.length})
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Watch Party
            {isHost && <Badge variant="secondary">Host</Badge>}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Party Code */}
          <div className="p-4 bg-secondary rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Party Code</p>
                <p className="text-2xl font-mono font-bold tracking-widest">
                  {party.party_code}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={copyCode}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Share this code with friends to invite them
            </p>
          </div>
          
          {/* Members */}
          <div>
            <h3 className="font-medium mb-3">
              Members ({members.length})
            </h3>
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
          </div>
          
          {/* Ready Button (for non-hosts) */}
          {!isHost && (
            <Button 
              onClick={() => setReady(true)}
              className="w-full"
              disabled={members.find(m => m.user_id === party.host_user_id)?.is_ready}
            >
              <Check className="h-4 w-4 mr-2" />
              I'm Ready
            </Button>
          )}
          
          {/* Playback Status */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              {party.is_playing ? "▶️ Playing" : "⏸️ Paused"} at{" "}
              {Math.floor(Number(party.playback_time) / 60)}:
              {String(Math.floor(Number(party.playback_time) % 60)).padStart(2, '0')}
            </p>
          </div>
          
          {/* Leave Button */}
          <Button 
            variant="destructive" 
            onClick={leaveParty}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isHost ? "End Party" : "Leave Party"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
